{{/*
App name — derived from chart name or .Values.nameOverride
*/}}
{{- define "sre-deploy-manager.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Full name — override with .Values.fullnameOverride, otherwise use chart name.
*/}}
{{- define "sre-deploy-manager.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "sre-deploy-manager.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/name: {{ include "sre-deploy-manager.name" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Backend selector labels
*/}}
{{- define "sre-deploy-manager.backendSelectorLabels" -}}
app.kubernetes.io/name: {{ include "sre-deploy-manager.name" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "sre-deploy-manager.frontendSelectorLabels" -}}
app.kubernetes.io/name: {{ include "sre-deploy-manager.name" . }}
app.kubernetes.io/component: frontend
{{- end }}
