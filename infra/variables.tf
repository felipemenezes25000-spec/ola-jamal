variable "aws_region" {
  default = "sa-east-1"
}

variable "environment" {
  default = "prod"
}

variable "project" {
  default = "renoveja"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "domain_name" {
  default = "renovejasaude.com.br"
}

variable "api_subdomain" {
  default = "api.renovejasaude.com.br"
}

variable "ecs_cpu" {
  default = 512
}

variable "ecs_memory" {
  default = 1024
}

variable "ecs_desired_count" {
  default = 2
}
