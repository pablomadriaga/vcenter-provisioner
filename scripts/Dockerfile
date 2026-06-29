# =============================================================================
# Dockerfile - Shared Scripts Image
# =============================================================================
# Imagen mínima con scripts compartidos para el sistema de monitoreo.
# Incluye: bash, curl, probe-scheduler.sh, shared-wrapper.sh, go-wrapper.sh, nginx-wrapper.sh
# =============================================================================

FROM alpine:3.24.0

# Instalar dependencias mínimas
RUN apk add --no-cache bash curl

# Copiar scripts
COPY probe-scheduler.sh /probe-scheduler.sh
COPY shared-wrapper.sh /shared-wrapper.sh
COPY go-wrapper.sh /go-wrapper.sh
COPY nginx-wrapper.sh /nginx-wrapper.sh
COPY nginx-wrapper-simple.sh /nginx-wrapper-simple.sh

# Hacer ejecutables
RUN chmod +x /probe-scheduler.sh /shared-wrapper.sh /go-wrapper.sh /nginx-wrapper.sh /nginx-wrapper-simple.sh

# Labels
ARG VERSION=1.0.0
LABEL version=${VERSION}
LABEL description="Shared scripts for vCenter Provisioner monitoring"
LABEL project="vcenter-provisioner"
LABEL service="shared-scripts"

ENTRYPOINT ["/probe-scheduler.sh"]
