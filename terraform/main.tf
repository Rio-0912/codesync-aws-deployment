provider "aws" {
  region = var.region
}

resource "aws_vpc" "codesync_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "codesync-vpc"
  }
}

resource "aws_internet_gateway" "codesync_igw" {
  vpc_id = aws_vpc.codesync_vpc.id

  tags = {
    Name = "codesync-igw"
  }
}

resource "aws_subnet" "codesync_public_subnet" {
  vpc_id                  = aws_vpc.codesync_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "codesync-public-subnet"
  }
}

resource "aws_route_table" "codesync_rt" {
  vpc_id = aws_vpc.codesync_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.codesync_igw.id
  }

  tags = {
    Name = "codesync-rt"
  }
}

resource "aws_route_table_association" "codesync_rta" {
  subnet_id      = aws_subnet.codesync_public_subnet.id
  route_table_id = aws_route_table.codesync_rt.id
}
