{{- define "apps.env" -}}
{{- required "env is required (local, dev, ...)" .Values.env -}}
{{- end }}

{{/* Shared by every child: sync on every commit, delete what Git no longer has, undo drift. */}}
{{- define "apps.syncPolicy" -}}
syncPolicy:
  automated:
    prune: true
    selfHeal: true
  syncOptions:
    - CreateNamespace=true
{{- end }}
