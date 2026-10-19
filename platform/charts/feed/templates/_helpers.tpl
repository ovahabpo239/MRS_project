{{- define "feed.labels" -}}
app.kubernetes.io/name: feed
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Values.image.tag | quote }}
app.kubernetes.io/part-of: resonance
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end }}

{{- define "feed.selectorLabels" -}}
app.kubernetes.io/name: feed
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
