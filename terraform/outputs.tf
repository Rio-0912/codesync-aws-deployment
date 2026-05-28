output "control_public_ip" {
  description = "Public IP of the K8s control plane node"
  value       = aws_eip.control_eip.public_ip
}

output "frontend_public_ip" {
  description = "Public IP of the frontend node"
  value       = aws_eip.frontend_eip.public_ip
}

output "backend_public_ip" {
  description = "Public IP of the backend node"
  value       = aws_eip.backend_eip.public_ip
}

output "control_private_ip" {
  value = aws_instance.control.private_ip
}

output "frontend_private_ip" {
  value = aws_instance.frontend.private_ip
}

output "backend_private_ip" {
  value = aws_instance.backend.private_ip
}
