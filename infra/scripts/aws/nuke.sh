#!/usr/bin/env bash
# Safety net for when `terraform destroy` was skipped or failed: removes everything the ephemeral
# AWS layer creates, in dependency order, and deletes the ephemeral state files so the next apply
# starts clean.
#
# AWS has no resource groups to delete in one go, so each kind is looked up by the tags every
# environment carries (project=<project>, lifecycle=ephemeral) or by the <project>-<env> names
# Terraform gives them. The bootstrap is tagged lifecycle=permanent and never matches.
#
# Usage: nuke.sh [--yes] [--project NAME] [--region REGION]
#   Without --yes it only prints what it would delete.
set -euo pipefail

project=resonance
region="${AWS_REGION:-$(aws configure get region 2>/dev/null || true)}"
region="${region:-eu-north-1}"
apply=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes) apply=true ;;
    --project) project="$2"; shift ;;
    --region) region="$2"; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

export AWS_REGION="$region" AWS_PAGER=""
backend="$(cd "$(dirname "$0")/../../terraform/aws" && pwd)/backend.hcl"
tag_filter=("Name=tag:project,Values=$project" "Name=tag:lifecycle,Values=ephemeral")

run() {
  if $apply; then
    "$@"
  else
    echo "would run: $*"
  fi
}

# Tagged resources of one type, as ARNs, from the tagging API.
tagged() {
  aws resourcegroupstaggingapi get-resources --resource-type-filters "$1" \
    --tag-filters Key=project,Values="$project" Key=lifecycle,Values=ephemeral \
    --query 'ResourceTagMappingList[].ResourceARN' --output text
}

echo "Region: $region"

# 1. EKS: node groups first, a cluster with node groups cannot be deleted.
clusters=$(tagged eks:cluster | tr '\t' '\n' | sed 's|.*:cluster/||')
echo "EKS clusters: ${clusters:-none}"
for cluster in $clusters; do
  for nodegroup in $(aws eks list-nodegroups --cluster-name "$cluster" --query 'nodegroups[]' --output text); do
    run aws eks delete-nodegroup --cluster-name "$cluster" --nodegroup-name "$nodegroup" >/dev/null
  done
  if $apply; then
    for nodegroup in $(aws eks list-nodegroups --cluster-name "$cluster" --query 'nodegroups[]' --output text); do
      aws eks wait nodegroup-deleted --cluster-name "$cluster" --nodegroup-name "$nodegroup"
    done
  fi
  run aws eks delete-cluster --name "$cluster" >/dev/null
  $apply && aws eks wait cluster-deleted --name "$cluster"

  # Load balancers created by Kubernetes Services carry the cluster tag, not the project tags.
  for lb in $(aws elbv2 describe-load-balancers --query 'LoadBalancers[].LoadBalancerArn' --output text); do
    owner=$(aws elbv2 describe-tags --resource-arns "$lb" \
      --query "TagDescriptions[].Tags[?Key=='elbv2.k8s.aws/cluster' || Key=='kubernetes.io/cluster/$cluster'].Value" --output text)
    [[ -z "$owner" ]] || run aws elbv2 delete-load-balancer --load-balancer-arn "$lb"
  done
  for lb in $(aws elb describe-load-balancers --query 'LoadBalancerDescriptions[].LoadBalancerName' --output text); do
    owner=$(aws elb describe-tags --load-balancer-names "$lb" \
      --query "TagDescriptions[].Tags[?Key=='kubernetes.io/cluster/$cluster'].Value" --output text)
    [[ -z "$owner" ]] || run aws elb delete-load-balancer --load-balancer-name "$lb"
  done
done

# 2. VPCs and everything inside them.
vpcs=$(aws ec2 describe-vpcs --filters "${tag_filter[@]}" --query 'Vpcs[].VpcId' --output text)
echo "VPCs: ${vpcs:-none}"
for vpc in $vpcs; do
  in_vpc=("Name=vpc-id,Values=$vpc")
  for eni in $(aws ec2 describe-network-interfaces --filters "${in_vpc[@]}" Name=status,Values=available \
    --query 'NetworkInterfaces[].NetworkInterfaceId' --output text); do
    run aws ec2 delete-network-interface --network-interface-id "$eni"
  done
  for sg in $(aws ec2 describe-security-groups --filters "${in_vpc[@]}" \
    --query "SecurityGroups[?GroupName!='default'].GroupId" --output text); do
    run aws ec2 delete-security-group --group-id "$sg"
  done
  for igw in $(aws ec2 describe-internet-gateways --filters Name=attachment.vpc-id,Values="$vpc" \
    --query 'InternetGateways[].InternetGatewayId' --output text); do
    run aws ec2 detach-internet-gateway --internet-gateway-id "$igw" --vpc-id "$vpc"
    run aws ec2 delete-internet-gateway --internet-gateway-id "$igw"
  done
  for subnet in $(aws ec2 describe-subnets --filters "${in_vpc[@]}" --query 'Subnets[].SubnetId' --output text); do
    run aws ec2 delete-subnet --subnet-id "$subnet"
  done
  for rt in $(aws ec2 describe-route-tables --filters "${in_vpc[@]}" \
    --query 'RouteTables[?!Associations[?Main]].RouteTableId' --output text); do
    run aws ec2 delete-route-table --route-table-id "$rt"
  done
  run aws ec2 delete-vpc --vpc-id "$vpc"
done

# 3. IAM roles and policies of the environments (<project>-<env>-*), never <project>-github.
roles=$(aws iam list-roles --query "Roles[?starts_with(RoleName, '$project-') && RoleName!='$project-github'].RoleName" --output text)
for role in $roles; do
  lifecycle=$(aws iam list-role-tags --role-name "$role" --query "Tags[?Key=='lifecycle'].Value" --output text)
  [[ "$lifecycle" == ephemeral ]] || continue
  echo "IAM role: $role"
  for policy in $(aws iam list-attached-role-policies --role-name "$role" --query 'AttachedPolicies[].PolicyArn' --output text); do
    run aws iam detach-role-policy --role-name "$role" --policy-arn "$policy"
  done
  for policy in $(aws iam list-role-policies --role-name "$role" --query 'PolicyNames[]' --output text); do
    run aws iam delete-role-policy --role-name "$role" --policy-name "$policy"
  done
  run aws iam delete-role --role-name "$role"
done
for policy in $(aws iam list-policies --scope Local \
  --query "Policies[?starts_with(PolicyName, '$project-')].Arn" --output text); do
  lifecycle=$(aws iam list-policy-tags --policy-arn "$policy" --query "Tags[?Key=='lifecycle'].Value" --output text)
  [[ "$lifecycle" == ephemeral ]] || continue
  echo "IAM policy: $policy"
  run aws iam delete-policy --policy-arn "$policy"
done

# 4. Secrets and KMS keys. Keys cannot be deleted at once; seven days is the shortest window.
for secret in $(aws secretsmanager list-secrets --filters Key=name,Values="$project/" \
  --query 'SecretList[].ARN' --output text); do
  run aws secretsmanager delete-secret --secret-id "$secret" --force-delete-without-recovery
done
for alias in $(aws kms list-aliases --query "Aliases[?starts_with(AliasName, 'alias/$project-')].AliasName" --output text); do
  run aws kms delete-alias --alias-name "$alias"
done
for key in $(tagged kms:key); do
  state=$(aws kms describe-key --key-id "$key" --query 'KeyMetadata.KeyState' --output text)
  [[ "$state" == PendingDeletion ]] && continue
  run aws kms schedule-key-deletion --key-id "$key" --pending-window-in-days 7
done

# 5. Ephemeral state: every object except the bootstrap state, lock files included.
if [[ -f "$backend" ]]; then
  bucket=$(sed -n 's/^bucket *= *"\(.*\)"/\1/p' "$backend")
  states=$(aws s3api list-objects-v2 --bucket "$bucket" \
    --query "Contents[?Key!='bootstrap.tfstate' && Key!='bootstrap.tfstate.tflock'].Key" --output text)
  for state in $states; do
    [[ "$state" == None ]] && continue
    run aws s3 rm "s3://$bucket/$state"
  done
fi

$apply || echo "Dry run. Re-run with --yes to delete."
