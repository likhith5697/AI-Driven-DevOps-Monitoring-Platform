resource "aws_vpc" "this" {
    cidr_block = var.cidr_block
    enable_dns_hostnames = true
    enable_dns_support = true
    tags = {Name = var.vpc_name}
}

resource "aws_subnet" "public"{
    vpc_id = aws_vpc.this.id
    cidr_block = var.public_subnet_cidr
    map_public_ip_on_launch = true
    availability_zone = var.az
    tags = { Name = "${var.vpc_name}-public" }
}

resource "aws_subnet" "private"{
    vpc_id = aws_vpc.this.id
    cidr_block = var.private_subnet_cidr
    availability_zone = var.az
    tags = { Name = "${var.vpc_name}-private" }
}