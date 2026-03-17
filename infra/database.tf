# ============================================================
# RDS PostgreSQL (free tier compatible)
# ============================================================

resource "aws_db_instance" "main" {
  identifier     = "${var.project}-postgres"
  engine         = "postgres"
  engine_version = "15"
  instance_class = "db.t3.micro"

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "renoveja"
  username = "postgres"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.public.name
  vpc_security_group_ids = [aws_security_group.aurora.id]
  # Access via bastion host or VPN — never expose RDS directly to the internet
  publicly_accessible    = false

  backup_retention_period = 30
  skip_final_snapshot     = false
  final_snapshot_identifier = "${var.project}-final-snapshot"
  multi_az                = true
  deletion_protection     = true

  tags = { Name = "${var.project}-postgres" }
}

# Subnet group com subnets PUBLICAS (para acesso pgAdmin)
resource "aws_db_subnet_group" "public" {
  name       = "${var.project}-db-public-subnets"
  subnet_ids = aws_subnet.public[*].id
  tags       = { Name = "${var.project}-db-public-subnets" }
}

# Manter o antigo para referência (será deletado)
# resource "aws_db_subnet_group" "main" removido

# ============================================================
# ElastiCache Redis
# ============================================================

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project}-redis-subnets"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_cluster" "main" {
  cluster_id           = "${var.project}-redis"
  engine               = "redis"
  node_type            = "cache.t4g.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.0"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]
}
