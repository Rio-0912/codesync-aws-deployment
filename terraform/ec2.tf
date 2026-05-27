data "aws_ami" "ubuntu" {
  most_recent = true
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
  owners = ["099720109477"] # Canonical
}

# Control Node
resource "aws_instance" "control" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  key_name      = var.key_name
  subnet_id     = aws_subnet.codesync_public_subnet.id
  vpc_security_group_ids = [aws_security_group.codesync_sg.id]
  private_ip    = "10.0.1.10"

  root_block_device {
    volume_size = 30
    volume_type = "gp2"
  }

  tags = {
    Name = "codesync-control"
    Role = "control"
  }
}

resource "aws_eip" "control_eip" {
  instance = aws_instance.control.id
  domain   = "vpc"
}

# Frontend Node
resource "aws_instance" "frontend" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  key_name      = var.key_name
  subnet_id     = aws_subnet.codesync_public_subnet.id
  vpc_security_group_ids = [aws_security_group.codesync_sg.id]
  private_ip    = "10.0.1.11"

  root_block_device {
    volume_size = 50
    volume_type = "gp2"
  }

  tags = {
    Name = "codesync-frontend"
    Role = "frontend"
  }
}

resource "aws_eip" "frontend_eip" {
  instance = aws_instance.frontend.id
  domain   = "vpc"
}

# Backend Node
resource "aws_instance" "backend" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  key_name      = var.key_name
  subnet_id     = aws_subnet.codesync_public_subnet.id
  vpc_security_group_ids = [aws_security_group.codesync_sg.id]
  private_ip    = "10.0.1.12"

  root_block_device {
    volume_size = 20
    volume_type = "gp2"
  }

  tags = {
    Name = "codesync-backend"
    Role = "backend"
  }
}

resource "aws_eip" "backend_eip" {
  instance = aws_instance.backend.id
  domain   = "vpc"
}
