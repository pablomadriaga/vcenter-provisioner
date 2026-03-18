#!/usr/bin/env bash
# =============================================================================
# build.sh - Smart Docker Build with Cache
# =============================================================================
# Generates .env.ci with deterministic hashes and builds Docker images.
# Features smart caching: only rebuild if hash changed.
# =============================================================================
# USAGE:
#   source scripts/ci/build.sh
#   build_all_services
#   build_single_service <service-name>
# =============================================================================

# Global variables
declare -A SERVICE_HASHES
declare -A BUILT_IMAGES
SHARED_SCRIPTS_HASH=""

# =============================================================================
# DOCKER BUILD FUNCTIONS
# =============================================================================

function image_exists_locally() {
    local image_tag="$1"
    
    if docker images --format "table {{.Repository}}:{{.Tag}}" | grep -q "^${image_tag}$"; then
        return 0
    else
        return 1
    fi
}

function build_docker_image() {
    local service="$1"
    local service_path="$2"
    local image_name="$3"
    local hash="$4"
    local force_build="${5:-false}"
    local shared_scripts_tag="${6:-local}"
    
    local image_tag="${image_name}:${hash}"
    local dockerfile_path="${service_path}/Dockerfile"
    
    # Check if Dockerfile exists
    if [[ ! -f "$dockerfile_path" ]]; then
        log_error "Dockerfile not found: $dockerfile_path"
        return 1
    fi
    
    # Check if image already exists and not forcing rebuild
    if [[ "$force_build" == "false" ]] && image_exists_locally "$image_tag"; then
        log_build_result "$service" "success" "$hash (cached)"
        BUILT_IMAGES["$service"]="$image_tag"
        return 0
    fi
    
    log_command "Building $service: $image_tag"
    
    # Build the image
    local build_start_time=$(date +%s)
    
    # Build args including shared scripts tag
    local build_args=()
    if [[ "$service" != "shared-scripts" ]]; then
        build_args+=("--build-arg" "SHARED_SCRIPTS_TAG=${SHARED_SCRIPTS_HASH}")
    fi
    
    if DOCKER_BUILDKIT=1 docker build "${build_args[@]}" -t "$image_tag" "$service_path"; then
        local build_end_time=$(date +%s)
        local build_duration=$((build_end_time - build_start_time))
        
        log_build_result "$service" "success" "$hash (${build_duration}s)"
        BUILT_IMAGES["$service"]="$image_tag"
        return 0
    else
        log_build_result "$service" "fail" "Build failed"
        return 1
    fi
}

function build_shared_scripts() {
    log_section "Building Shared Scripts"
    
    local shared_scripts_path="scripts"
    local image_name="antigravity/shared-scripts"
    
    # Calculate hash for shared-scripts
    SHARED_SCRIPTS_HASH=$(get_directory_hash "$shared_scripts_path")
    log_info "shared-scripts hash: $SHARED_SCRIPTS_HASH"
    
    # Build shared-scripts image
    if build_docker_image "shared-scripts" "$shared_scripts_path" "$image_name" "$SHARED_SCRIPTS_HASH" "$FORCE_BUILD" "local"; then
        # Also tag with expected name for Dockerfile references
        docker tag "${image_name}:${SHARED_SCRIPTS_HASH}" "shared-scripts:${SHARED_SCRIPTS_HASH}"
        SERVICE_HASHES["shared-scripts"]="$SHARED_SCRIPTS_HASH"
        log_success "Shared scripts built successfully"
        return 0
    else
        log_error "Failed to build shared scripts"
        return 1
    fi
}

function build_single_service() {
    local service="$1"
    local force_build="${2:-false}"
    
    # Get service configuration
    local service_path
    service_path=$(get_service_config "$service" "path" 2>/dev/null || echo "")
    local image_name
    image_name=$(get_service_config "$service" "imageName" 2>/dev/null || echo "")
    
    if [[ -z "$service_path" || "$service_path" == "null" || -z "$image_name" || "$image_name" == "null" ]]; then
        log_error "Invalid configuration for service: $service"
        return 1
    fi
    
    # Full path to service
    local full_service_path="$BASE_DIR/$service_path"
    
    if [[ ! -d "$full_service_path" ]]; then
        log_error "Service directory not found: $full_service_path"
        return 1
    fi
    
    # Calculate service hash (including shared-scripts dependency)
    local service_hash
    service_hash=$(get_service_hash "$full_service_path" "$SHARED_SCRIPTS_HASH")
    
    log_info "$service hash: $service_hash"
    
    # Build the service image
    if build_docker_image "$service" "$full_service_path" "$image_name" "$service_hash" "$force_build" "$SHARED_SCRIPTS_HASH"; then
        SERVICE_HASHES["$service"]="$service_hash"
        return 0
    else
        log_error "Failed to build service: $service"
        return 1
    fi
}

# =============================================================================
# BUILD ORCHESTRATION
# =============================================================================

function build_all_services() {
    log_banner "Smart Build Pipeline"
    
    local build_start_time=$(date +%s)
    local total_services=0
    local successful_builds=0
    local failed_builds=0
    
    # Store original directory
    local original_dir
    original_dir=$(pwd)
    
    # Ensure we're in project root
    cd "$BASE_DIR" || {
        log_error "Cannot change to project directory: $BASE_DIR"
        return 1
    }
    
    # Step 1: Build shared-scripts first (dependency for all services)
    log_step 1 2 "Building shared-scripts (critical dependency)"
    if build_shared_scripts; then
        ((successful_builds++))
    else
        log_error "Failed to build shared-scripts, cannot continue"
        cd "$original_dir"
        return 1
    fi
    ((total_services++))
    
    # Step 2: Get list of services from configuration
    log_step 2 2 "Building application services"
    local services
    services=$(jq -r '.services | keys[]' "$SERVICES_FILE" 2>/dev/null | grep -v "shared-scripts" || true)
    
    if [[ -z "$services" ]]; then
        log_warning "No services found in configuration"
        cd "$original_dir"
        return 0
    fi
    
    # Build each service
    for service in $services; do
        log_info "Building service: $service"
        
        if build_single_service "$service" "$FORCE_BUILD"; then
            ((successful_builds++))
        else
            ((failed_builds++))
            # Continue building other services even if one fails
        fi
        ((total_services++))
        
        echo ""  # Add spacing between builds
    done
    
    # Step 3: Generate .env.ci file
    log_section "Generating Environment File"
    generate_env_file "$ENV_FILE" "$SERVICES_FILE"
    
    # Step 4: Build summary
    log_section "Build Summary"
    log_info "Total services: $total_services"
    log_success "Successful builds: $successful_builds"
    
    if [[ $failed_builds -gt 0 ]]; then
        log_error "Failed builds: $failed_builds"
    fi
    
    # Calculate total time
    local build_end_time=$(date +%s)
    local total_duration=$((build_end_time - build_start_time))
    log_time "Total build time" "$build_start_time" "$build_end_time"
    
    # Return to original directory
    cd "$original_dir"
    
    # Return appropriate exit code
    if [[ $failed_builds -gt 0 ]]; then
        log_warning "Some builds failed"
        return 1
    else
        log_success_banner "All Services Built Successfully"
        return 0
    fi
}

function build_services_parallel() {
    # Advanced function for parallel builds (future enhancement)
    log_info "Parallel builds not implemented yet, using sequential build"
    build_all_services
}

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

function get_image_tag_for_service() {
    local service="$1"
    
    if [[ -n "${BUILT_IMAGES[$service]:-}" ]]; then
        echo "${BUILT_IMAGES[$service]}"
        return 0
    fi
    
    # Fallback to configuration
    local image_name
    image_name=$(get_service_config "$service" "imageName" 2>/dev/null || echo "")
    local hash="${SERVICE_HASHES[$service]:-}"
    
    if [[ -n "$image_name" && -n "$hash" ]]; then
        echo "${image_name}:${hash}"
    else
        echo ""
    fi
}

function list_built_images() {
    log_section "Built Images"
    
    if [[ ${#BUILT_IMAGES[@]} -eq 0 ]]; then
        log_warning "No images built yet"
        return
    fi
    
    for service in "${!BUILT_IMAGES[@]}"; do
        local image_tag="${BUILT_IMAGES[$service]}"
        log_info "$service: $image_tag"
        
        # Show image size if available
        local size
        size=$(docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep "^${image_tag}" | cut -f2 || echo "Unknown")
        echo "  Size: $size"
    done
}

function clean_old_images() {
    log_section "Cleaning Old Images"
    
    # Remove images with our prefix that have no tags
    local old_images
    old_images=$(docker images "antigravity/*" --format "{{.Repository}}:{{.Tag}}" | grep -E ":latest$|:local$" || true)
    
    if [[ -n "$old_images" ]]; then
        log_info "Removing old images:"
        echo "$old_images" | while IFS= read -r image; do
            if [[ -n "$image" ]]; then
                log_command "Removing: $image"
                docker rmi "$image" 2>/dev/null || true
            fi
        done
    else
        log_info "No old images to remove"
    fi
}

# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================

function validate_build_prerequisites() {
    log_section "Validating Build Prerequisites"
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        return 1
    fi
    
    # Check disk space (simplified)
    local available_space
    available_space=$(df . | tail -1 | awk '{print $4}')
    local required_space=1048576  # 1GB in KB
    
    if [[ $available_space -lt $required_space ]]; then
        log_warning "Low disk space detected: ${available_space}KB available"
    fi
    
    log_success "Build prerequisites validated"
    return 0
}

# =============================================================================
# EXPORT FUNCTIONS
# =============================================================================

export -f image_exists_locally
export -f build_docker_image
export -f build_shared_scripts
export -f build_single_service
export -f build_all_services
export -f build_services_parallel
export -f get_image_tag_for_service
export -f list_built_images
export -f clean_old_images
export -f validate_build_prerequisites

# =============================================================================
# END OF FILE
# =============================================================================