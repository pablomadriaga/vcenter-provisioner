#!/usr/bin/env python3
"""
vCenter Provisioner Pipeline v2.0

CLI para orchestrar el pipeline de CI/CD.
"""

import sys
import logging
import json
from pathlib import Path

import click


# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)


@click.group()
@click.option("-v", "--verbose", is_flag=True, help="Enable verbose output")
@click.option("-q", "--quiet", is_flag=True, help="Only show errors")
@click.pass_context
def cli(ctx, verbose, quiet):
    """vCenter Provisioner Pipeline v2.0
    
    Orchestrates CI/CD operations for the vCenter Provisioner project.
    """
    # Configurar nivel de logging
    if verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    elif quiet:
        logging.getLogger().setLevel(logging.ERROR)
    
    # Guardar contexto
    ctx.ensure_object(dict)
    ctx.obj["verbose"] = verbose


@cli.command()
@click.option("--manifest", default="config/test-manifest.json", 
              help="Path to test manifest")
@click.option("--mode", "test_mode", default="hybrid",
              type=click.Choice(["host", "docker", "hybrid"]),
              help="Test execution mode")
@click.option("--service", "-s", multiple=True, help="Specific services to test")
@click.option("--parallel", is_flag=True, help="Run tests in parallel")
@click.pass_context
def test(ctx, manifest, test_mode, service, parallel):
    """Execute test suites.
    
    Runs tests in the specified mode:
    - host: Run tests directly on the host
    - docker: Run tests inside Docker containers
    - hybrid: Run both modes
    """
    from agents.test.runner import TestRunner
    from agents.config import get_config_loader
    
    logger.info(f"Running tests in {test_mode} mode")
    
    # Cargar configuración
    try:
        config_loader = get_config_loader()
        # Validar que el manifest existe
        config_loader.load_manifest()
    except Exception as e:
        click.echo(f"Error loading manifest: {e}", err=True)
        sys.exit(1)
    
    # Configurar agente
    agent_config = {
        "mode": test_mode,
        "parallel": parallel,
        "services": list(service) if service else None
    }
    
    runner = TestRunner(agent_config)
    
    # Validar prerrequisitos
    if not runner.validate():
        click.echo("Validation failed: prerequisites not met", err=True)
        sys.exit(2)
    
    # Ejecutar
    result = runner.run()
    
    # Output JSON
    click.echo(result.to_json())
    
    # Exit code según resultado
    if result.status == "success":
        sys.exit(0)
    elif result.status == "skipped":
        sys.exit(3)
    else:
        sys.exit(1)


@cli.command()
@click.option("--fix", is_flag=True, help="Automatically fix issues")
@click.option("--services", "-s", multiple=True, help="Specific services to lint")
@click.pass_context
def lint(ctx, fix, services):
    """Run linting checks on all services.
    
    Executes linting for:
    - Python code (ruff)
    - JavaScript/TypeScript code (eslint)
    - Shell scripts (shellcheck)
    - Docker files (hadolint)
    """
    from agents.lint.runner import LintRunner
    
    agent_config = {
        "fix": fix,
        "services": list(services) if services else None
    }
    
    runner = LintRunner(agent_config)
    
    if not runner.validate():
        click.echo("Validation failed", err=True)
        sys.exit(2)
    
    result = runner.run()
    click.echo(result.to_json())
    
    if result.status == "success":
        sys.exit(0)
    else:
        sys.exit(1)


@cli.command()
@click.option("--force", is_flag=True, help="Force rebuild (skip cache)")
@click.option("--services", "-s", multiple=True, help="Specific services to build")
@click.option("--workers", default=4, help="Number of parallel workers")
@click.pass_context
def build(ctx, force, services, workers):
    """Build Docker images.
    
    Builds all service images using Docker with smart caching.
    Uses parallel builds for faster execution.
    """
    from agents.build.runner import BuildRunner
    
    logger.info(f"Building images (force={force}, services={services}, workers={workers})")
    
    # Configurar agente
    agent_config = {
        "force": force,
        "services": list(services) if services else None,
        "parallel_workers": workers
    }
    
    runner = BuildRunner(agent_config)
    
    # Validar prerrequisitos
    if not runner.validate():
        click.echo("Validation failed: Docker not available", err=True)
        sys.exit(2)
    
    # Ejecutar
    result = runner.run()
    
    # Output JSON
    click.echo(result.to_json())
    
    # Exit code según resultado
    if result.status == "success":
        sys.exit(0)
    else:
        sys.exit(1)


@cli.command()
@click.pass_context
def validate(ctx):
    """Validate prerequisites.
    
    Checks:
    - Docker is installed and running
    - Required tools are available
    - Configuration files are valid
    """
    from agents.validate.runner import ValidateRunner
    
    runner = ValidateRunner()
    result = runner.execute()
    click.echo(result.to_json())
    
    if result.status == "success":
        sys.exit(0)
    else:
        sys.exit(1)


@cli.command()
@click.option("--services", "-s", multiple=True, help="Specific services to start")
@click.pass_context
def up(ctx, services):
    """Start services.
    
    Starts the infrastructure and application services.
    """
    from agents.services.runner import ServicesRunner
    
    agent_config = {
        "action": "up",
        "services": list(services) if services else None
    }
    
    runner = ServicesRunner(agent_config)
    
    if not runner.validate():
        click.echo("Validation failed: Docker not available", err=True)
        sys.exit(2)
    
    result = runner.run()
    click.echo(result.to_json())
    
    if result.status == "success":
        sys.exit(0)
    else:
        sys.exit(1)


@cli.command()
@click.pass_context
def down(ctx):
    """Stop services.
    
    Stops all running containers.
    """
    from agents.services.runner import ServicesRunner
    
    agent_config = {"action": "down"}
    
    runner = ServicesRunner(agent_config)
    
    if not runner.validate():
        click.echo("Validation failed: Docker not available", err=True)
        sys.exit(2)
    
    result = runner.run()
    click.echo(result.to_json())
    
    if result.status == "success":
        sys.exit(0)
    else:
        sys.exit(1)


@cli.command()
@click.pass_context
def status(ctx):
    """Show services status.
    
    Displays the current status of all services with health checks.
    """
    from agents.services.runner import ServicesRunner
    
    agent_config = {"action": "status"}
    
    runner = ServicesRunner(agent_config)
    
    if not runner.validate():
        click.echo("Validation failed: Docker not available", err=True)
        sys.exit(2)
    
    result = runner.run()
    click.echo(result.to_json())
    
    if result.status == "success":
        sys.exit(0)
    else:
        sys.exit(1)


@cli.command()
@click.option("--full", is_flag=True, help="Full cleanup including volumes")
@click.pass_context
def cleanup(ctx, full):
    """Clean up Docker resources.
    
    Removes containers, networks, and optionally volumes.
    """
    from agents.cleanup.runner import CleanupRunner
    
    agent_config = {"full": full}
    
    runner = CleanupRunner(agent_config)
    
    if not runner.validate():
        click.echo("Validation failed: Docker not available", err=True)
        sys.exit(2)
    
    result = runner.run()
    click.echo(result.to_json())
    
    if result.status == "success":
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    cli(obj={})
