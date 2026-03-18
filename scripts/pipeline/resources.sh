# =============================================================================
# CLEANUP RESOURCES
# =============================================================================
# Project resources to clean
readonly PROJECT_CONTAINERS=(
    "provisioner-typing"
    "provisioner-auth"
    "provisioner-stats"
    "provisioner-gateway"
    "provisioner-vm-orchestrator"
    "provisioner-vcenter-adapter"
    "provisioner-monitoring"
    "provisioner-backup"
    "provisioner-ui"
    "vcenter-provisioner-db"
    "vcenter-provisioner-redis"
)

readonly PROJECT_NETWORKS=(
    "vcenter-provisioner_default"
    "vcenter-provisioner_antigravity-network"
)

readonly PROJECT_VOLUMES=(
    "vcenter-provisioner_postgres_data"
    "vcenter-provisioner_redis_data"
)
