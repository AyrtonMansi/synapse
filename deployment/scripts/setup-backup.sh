#!/bin/bash
# setup-backup.sh - Backup Procedures Setup

set -e

echo "═══════════════════════════════════════════════════════════"
echo "           BACKUP PROCEDURES SETUP"
echo "═══════════════════════════════════════════════════════════"
echo ""

BACKUP_DIR="${1:-/backup/synapse}"
RETENTION_DAYS=30

echo "Backup directory: $BACKUP_DIR"
echo "Retention: $RETENTION_DAYS days"
echo ""

# Create backup directory
sudo mkdir -p "$BACKUP_DIR"
sudo mkdir -p "$BACKUP_DIR/postgres"
sudo mkdir -p "$BACKUP_DIR/ipfs"
sudo mkdir -p "$BACKUP_DIR/configs"

# ========================================
# PostgreSQL Backup Script
# ========================================
cat > /usr/local/bin/backup-postgres.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/synapse/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="postgres_backup_$DATE.sql.gz"

echo "Starting PostgreSQL backup: $FILENAME"

docker exec synapse-postgres pg_dump -U postgres synapse | gzip > "$BACKUP_DIR/$FILENAME"

if [ $? -eq 0 ]; then
    echo "✅ Backup successful: $FILENAME"
    # Keep only last 30 backups
    ls -t "$BACKUP_DIR"/*.sql.gz | tail -n +31 | xargs rm -f
else
    echo "❌ Backup failed"
    exit 1
fi
EOF

chmod +x /usr/local/bin/backup-postgres.sh

# ========================================
# IPFS Backup Script
# ========================================
cat > /usr/local/bin/backup-ipfs.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/synapse/ipfs"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="ipfs_backup_$DATE.tar.gz"

echo "Starting IPFS backup: $FILENAME"

# Stop IPFS node temporarily for consistent backup
docker stop synapse-ipfs-us-east synapse-ipfs-eu-west synapse-ipfs-apac

# Backup IPFS data
tar -czf "$BACKUP_DIR/$FILENAME" -C /var/lib/docker/volumes/synapse_ipfs-data-us-east/_data .

# Restart IPFS nodes
docker start synapse-ipfs-us-east synapse-ipfs-eu-west synapse-ipfs-apac

if [ $? -eq 0 ]; then
    echo "✅ Backup successful: $FILENAME"
    # Keep only last 10 backups (IPFS backups are large)
    ls -t "$BACKUP_DIR"/*.tar.gz | tail -n +11 | xargs rm -f
else
    echo "❌ Backup failed"
    exit 1
fi
EOF

chmod +x /usr/local/bin/backup-ipfs.sh

# ========================================
# Configuration Backup Script
# ========================================
cat > /usr/local/bin/backup-configs.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/synapse/configs"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="configs_backup_$DATE.tar.gz"

echo "Starting configuration backup: $FILENAME"

tar -czf "$BACKUP_DIR/$FILENAME" -C /path/to/synapse/deployment/configs .

if [ $? -eq 0 ]; then
    echo "✅ Backup successful: $FILENAME"
    # Keep only last 30 backups
    ls -t "$BACKUP_DIR"/*.tar.gz | tail -n +31 | xargs rm -f
else
    echo "❌ Backup failed"
    exit 1
fi
EOF

chmod +x /usr/local/bin/backup-configs.sh

# ========================================
# Full Backup Script
# ========================================
cat > /usr/local/bin/backup-all.sh << 'EOF'
#!/bin/bash

echo "═══════════════════════════════════════════════════════════"
echo "           SYNAPSE FULL BACKUP"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Started: $(date)"
echo ""

backup-postgres.sh
backup-ipfs.sh
backup-configs.sh

echo ""
echo "Backup completed: $(date)"
echo ""
EOF

chmod +x /usr/local/bin/backup-all.sh

# ========================================
# Setup Cron Jobs
# ========================================
echo "🕐 Setting up cron jobs..."

# PostgreSQL backup every 6 hours
(crontab -l 2>/dev/null; echo "0 */6 * * * /usr/local/bin/backup-postgres.sh >> /var/log/synapse-backup.log 2>&1") | crontab -

# IPFS backup daily at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-ipfs.sh >> /var/log/synapse-backup.log 2>&1") | crontab -

# Configuration backup daily at 3 AM
(crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/backup-configs.sh >> /var/log/synapse-backup.log 2>&1") | crontab -

# Full backup weekly on Sundays at 4 AM
(crontab -l 2>/dev/null; echo "0 4 * * 0 /usr/local/bin/backup-all.sh >> /var/log/synapse-backup.log 2>&1") | crontab -

# Create log file
sudo touch /var/log/synapse-backup.log
sudo chmod 644 /var/log/synapse-backup.log

# ========================================
# Restore Script
# ========================================
cat > /usr/local/bin/restore-backup.sh << 'EOF'
#!/bin/bash
# restore-backup.sh - Restore from backup

set -e

if [ -z "$1" ]; then
    echo "Usage: restore-backup.sh <backup_file>"
    echo ""
    echo "Available backups:"
    ls -la /backup/synapse/*/
    exit 1
fi

BACKUP_FILE="$1"

echo "⚠️  WARNING: This will restore from backup and may overwrite current data!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo "Restoring from: $BACKUP_FILE"

# Detect backup type
if [[ "$BACKUP_FILE" == *"postgres"* ]]; then
    echo "Restoring PostgreSQL..."
    gunzip < "$BACKUP_FILE" | docker exec -i synapse-postgres psql -U postgres synapse
elif [[ "$BACKUP_FILE" == *"ipfs"* ]]; then
    echo "Restoring IPFS..."
    docker stop synapse-ipfs-us-east synapse-ipfs-eu-west synapse-ipfs-apac
    rm -rf /var/lib/docker/volumes/synapse_ipfs-data-us-east/_data/*
    tar -xzf "$BACKUP_FILE" -C /var/lib/docker/volumes/synapse_ipfs-data-us-east/_data
    docker start synapse-ipfs-us-east synapse-ipfs-eu-west synapse-ipfs-apac
elif [[ "$BACKUP_FILE" == *"configs"* ]]; then
    echo "Restoring configs..."
    tar -xzf "$BACKUP_FILE" -C /path/to/synapse/deployment/configs
fi

echo "✅ Restore complete!"
EOF

chmod +x /usr/local/bin/restore-backup.sh

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "           ✅ BACKUP PROCEDURES CONFIGURED"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Backup Schedule:"
echo "  • PostgreSQL: Every 6 hours"
echo "  • IPFS: Daily at 2:00 AM"
echo "  • Configs: Daily at 3:00 AM"
echo "  • Full: Weekly on Sundays at 4:00 AM"
echo ""
echo "Backup Location: $BACKUP_DIR"
echo "Retention: $RETENTION_DAYS days"
echo ""
echo "Commands:"
echo "  • Manual backup: backup-all.sh"
echo "  • Restore: restore-backup.sh <file>"
echo "  • View logs: tail -f /var/log/synapse-backup.log"
echo ""
