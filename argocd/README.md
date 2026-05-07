# ArgoCD Deployment Guide

## Before applying the ArgoCD Application, run these once on the cluster:

### 1. Create namespace (if not using CreateNamespace=true)
```bash
kubectl create namespace sre-tools-dev
```

### 2. Image pull secret (GitLab Container Registry)
```bash
kubectl create secret docker-registry gitlab-registry-secret \
  --docker-server=registry.gitlab.com \
  --docker-username=<gitlab-username-or-deploy-token-name> \
  --docker-password=<gitlab-deploy-token-or-password> \
  -n sre-tools-dev
```
> Alternatively ask infra to mirror images to SWR and update `image.repository` in `helm/values.yaml`.

### 3. Backend secret (sensitive env vars)
```bash
kubectl create secret generic sre-deploy-manager-backend \
  --from-literal=DATABASE_URL='postgresql://user:pass@host:5432/dbname' \
  --from-literal=JWT_SECRET='your-jwt-secret' \
  --from-literal=IVANTI_API_KEY='your-ivanti-api-key' \
  -n sre-tools-dev
```

### 4. TLS secret (if using HTTPS)
Either:
- Use an existing wildcard cert already in the cluster, update `ingress.tlsSecretName` in `values.yaml`, or
- Ask infra to provision via cert-manager

### 5. Apply the ArgoCD Application
```bash
kubectl apply -f argocd/application-dev.yaml
```

---

## Customise before deploying

Edit `helm/values.yaml`:

| Field | Default | Notes |
|---|---|---|
| `namespace` | `sre-tools-dev` | Must match destination in `application-dev.yaml` |
| `ingress.host` | `sre-deploy.local.altodev.id` | Ask infra for the right subdomain |
| `ingress.tlsSecretName` | `sre-deploy-dev-tls` | Must already exist in the namespace |
| `ingress.className` | `haproxy` | Change if cluster uses a different ingress controller |
| `backend.image.tag` / `frontend.image.tag` | `latest` | Pin to a specific `sha-<short>` tag from CI for stability |
| `argocd > project` | `default` | Change to the actual ArgoCD project name |
