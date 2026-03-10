
# AWS provider configuration
provider "aws" {
  region = "us-east-2"  # use the region where your key 'genai-tf-key' exists
}


module "vpc" {
  source = "./modules/vpc"
}

module "sg" {
  source         = "./modules/security_groups"
  vpc_id         = module.vpc.vpc_id
  ssh_allowed_ip = "104.187.119.191/32"
}

module "iam" {
  source = "./modules/iam"
}


module "ec2" {
  source        = "./modules/ec2"
   ami           = var.ami
  instance_type = "t2.micro"
  key_name      = "genai-tf-key"        # your actual key pair
  subnet_id     = module.vpc.public_subnet_id  # output from VPC module
  sg_id         = module.sg.sg_id              # output from SG module
  name          = "GenAI-Stack"
}