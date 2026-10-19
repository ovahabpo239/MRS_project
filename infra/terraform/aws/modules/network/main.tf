# One VPC per environment with public subnets in two zones (EKS requires at least two). Nodes get
# public IPs and reach the internet through the internet gateway, so no NAT gateway is needed:
# that saves about USD 1 per day. Private subnets and VPC endpoints come with the hub-and-spoke
# network (spec 7.6).

terraform {
  required_version = ">= 1.15"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.60"
    }
  }
}

variable "name" {
  description = "Name stem, e.g. resonance-dev."
  type        = string
}

variable "cidr_block" {
  description = "VPC address space. Differs from the Azure VNet (10.10.0.0/16) so the two can be peered later."
  type        = string
  default     = "10.20.0.0/16"
}

variable "az_count" {
  description = "Availability zones to spread subnets over."
  type        = number
  default     = 2
}

variable "cluster_name" {
  description = "EKS cluster that may place load balancers in these subnets."
  type        = string
}

variable "tags" {
  description = "Extra tags on top of the provider default tags."
  type        = map(string)
  default     = {}
}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  zones = slice(data.aws_availability_zones.available.names, 0, var.az_count)
}

resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = merge(var.tags, { Name = "vpc-${var.name}" })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "igw-${var.name}" })
}

# A /20 per zone leaves room for VPC CNI, which gives every pod an address from the subnet.
resource "aws_subnet" "public" {
  for_each = { for index, zone in local.zones : zone => index }

  vpc_id                  = aws_vpc.this.id
  availability_zone       = each.key
  cidr_block              = cidrsubnet(var.cidr_block, 4, each.value)
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name                                        = "snet-${var.name}-public-${each.key}"
    "kubernetes.io/role/elb"                    = "1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = merge(var.tags, { Name = "rt-${var.name}-public" })
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

output "vpc_id" {
  value = aws_vpc.this.id
}

output "subnet_ids" {
  value = [for subnet in aws_subnet.public : subnet.id]
}
