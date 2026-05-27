resource "aws_security_group" "codesync_sg" {
  name        = "codesync-sg"
  description = "Security group for CodeSync K8s cluster"
  vpc_id      = aws_vpc.codesync_vpc.id

  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "codesync-sg"
  }
}
