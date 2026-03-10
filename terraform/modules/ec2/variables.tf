variable "ami" {
  description = "AMI ID for the EC2 instance"
}

variable "instance_type" {
  description = "EC2 instance type"
}

variable "key_name" {
  description = "Key pair name for SSH access"
}

variable "subnet_id" {
  description = "Subnet ID for the EC2 instance"
}

variable "sg_id" {
  description = "Security Group ID for the EC2 instance"
}

variable "name" {
  description = "Name tag for the EC2 instance"
  default     = "GenAI-Stack"
}