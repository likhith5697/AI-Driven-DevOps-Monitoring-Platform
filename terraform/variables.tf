variable "aws_region" { default = "us-east-1" }
variable "ami" { default = "ami-0a91cd140a1fc148a" } # Ubuntu 22.04 LTS
variable "instance_type" { default = "t2.micro" }
variable "key_name" {}