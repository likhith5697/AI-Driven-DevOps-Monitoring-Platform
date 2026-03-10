variable "vpc_id" {}
variable "sg_name" { default = "genai-sg" }
variable "ssh_allowed_ip" { description = "Your IP for SSH" }