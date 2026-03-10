# Fetch the latest Ubuntu 22.04 LTS AMI dynamically
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "this" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t3.micro"
  key_name               = var.key_name
  subnet_id              = var.subnet_id           # <-- use variable
  vpc_security_group_ids = [var.sg_id]            # <-- use variable

  tags = {
    Name = var.name
  }

  user_data = <<-EOF
              #!/bin/bash
              apt update -y
              apt install -y docker.io docker-compose git
              usermod -aG docker ubuntu
              cd /home/ubuntu
              git clone https://github.com/likhith5697/AI-Driven-DevOps-Monitoring-Platform.git
              cd AI-Driven-DevOps-Monitoring-Platform
              docker compose -f docker-compose.yml up -d --build
              EOF
}