"""Migration: Create provision_logs and custom_charts tables

Revision ID: 001
Revises:
Create Date: 2026-02-05
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # provision_logs table - tracks all provisioning operations
    op.create_table(
        'provision_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('job_id', sa.String(100), nullable=False, unique=True),
        sa.Column('vm_name', sa.String(255), nullable=False),
        sa.Column('status', sa.String(50), nullable=False),  # PENDING, SUCCESS, FAILED
        sa.Column('vm_class_id', sa.Integer(), nullable=True),
        sa.Column('vm_class_name', sa.String(100), nullable=True),
        sa.Column('vcenter_id', sa.Integer(), nullable=True),
        sa.Column('vcenter_name', sa.String(255), nullable=True),
        sa.Column('error_reason', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_id'),
    )

    op.create_index('idx_provision_logs_status', 'provision_logs', ['status'])
    op.create_index('idx_provision_logs_created_at', 'provision_logs', ['created_at'])
    op.create_index('idx_provision_logs_vm_class', 'provision_logs', ['vm_class_id'])
    op.create_index('idx_provision_logs_vcenter', 'provision_logs', ['vcenter_id'])

    # custom_charts table - user saved chart configurations
    op.create_table(
        'custom_charts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('chart_type', sa.String(50), nullable=False),  # line, bar, area
        sa.Column('metric', sa.String(100), nullable=False),  # provisions, success_rate, etc.
        sa.Column('group_by', sa.String(100), nullable=True),  # vm_class, vcenter, hourly, daily
        sa.Column('timeframe', sa.String(50), nullable=False, default='7d'),  # 1h, 24h, 7d, 30d
        sa.Column('filters', sa.JSON(), nullable=True),  # {vm_class_id: 1, vcenter_id: 2}
        sa.Column('is_public', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_index('idx_custom_charts_user', 'custom_charts', ['user_id'])


def downgrade() -> None:
    op.drop_index('idx_custom_charts_user', table_name='custom_charts')
    op.drop_table('custom_charts')
    op.drop_index('idx_provision_logs_vcenter', table_name='provision_logs')
    op.drop_index('idx_provision_logs_vm_class', table_name='provision_logs')
    op.drop_index('idx_provision_logs_created_at', table_name='provision_logs')
    op.drop_index('idx_provision_logs_status', table_name='provision_logs')
    op.drop_table('provision_logs')
