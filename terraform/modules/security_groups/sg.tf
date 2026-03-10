resource "aws_security_group" "services_sg" {
  name        = var.sg_name
  description = "Allow Node, Python, Observability services"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
  from_port   = 3000
  to_port     = 3000
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"] # Node API
}

ingress {
  from_port   = 3001
  to_port     = 3001
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"] # Prometheus
}

ingress {
  from_port   = 5601
  to_port     = 5601
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"] # OpenSearch
}

ingress {
  from_port   = 3002
  to_port     = 3002
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"] # Grafana
}

egress {
  from_port   = 0
  to_port     = 0
  protocol    = "-1"
  cidr_blocks = ["0.0.0.0/0"]
}
}