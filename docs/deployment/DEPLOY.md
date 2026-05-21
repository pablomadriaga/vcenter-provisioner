---
description: "Guía de deploy K8s: dev/staging/prod, kubectl, kustomize, verificación"
category: deployment
priority: high
agent_role: deploy
paths: ["k8s/overlays/**"]
---

# Deploy Guide — vCenter Provisioner

## Environments

| Environment | Namespace | Branch | Trigger |
|---|---|---|---|
| **dev** | `vcenter-provisioner-dev` | `k8s` | Manual (`--k8s-deploy-dev`) |
| **staging** | `vcenter-provisioner-staging` | `main` | Manual (`--k8s-deploy-staging`) |
| **prod** | `vcenter-provisioner-prod` | `main` | Manual (`--k8s-deploy-prod`) |

## Prerequisites

- `kubectl` configured with cluster access
- `kustomize` (bundled with kubectl >= 1.22)
- Docker registry access (`DOCKER_REGISTRY` env var)
- Docker images built and pushed to registry

## Quick Deploy

> **Nota:** `./pipeline.sh` wrappea `kubectl apply -k` por conveniencia. Para deploys directos se prefiere `kubectl apply -k`.

### Push images and deploy

```bash
export DOCKER_REGISTRY=your-registry.example.com
./pipeline.sh --k8s-push

# Deploy por entorno
./pipeline.sh --k8s-deploy-dev      # → kubectl apply -k k8s/overlays/dev/
./pipeline.sh --k8s-deploy-staging
./pipeline.sh --k8s-deploy-prod
```

## Kustomize Overlay Structure

```
k8s/
├── base/                  # Recursos comunes a todos los entornos
│   ├── deployment.yaml
│   ├── service.yaml
│   └── kustomization.yaml
└── overlays/{env}/
    └── kustomization.yaml # References base/, applies patches
        └── patches/       # Environment-specific patches
```

Each overlay inherits all base resources:
- Resource limits (dev: minimal, prod: scaled)
- Replica counts (dev: 1, staging: 2, prod: 3+)
- Certificate issuers (dev: staging, prod: production)

## Manual Deploy (K8s Native)

```bash
# Apply base + dev overlay
kubectl apply -k k8s/overlays/dev/

# Wait for all deployments
kubectl wait --for=condition=available --timeout=300s deployment --all -n vcenter-provisioner-dev
```

## Post-Deploy Verification

```bash
# Pods y rollout
kubectl get pods -n vcenter-provisioner-dev
kubectl rollout status deployment -n vcenter-provisioner-dev

# HTTPProxy
kubectl get httpproxy -n vcenter-provisioner-dev

# Logs y health
kubectl logs -l app=api-gateway -n vcenter-provisioner-dev --tail=50
curl -k https://vc-ui.playground.net/auth/health
```

Check Coroot for service metrics post-deploy.

## Rollback

```bash
kubectl rollout undo deployment/<service> -n vcenter-provisioner-dev
```
