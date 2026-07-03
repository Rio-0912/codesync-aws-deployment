import jenkins.model.*
import hudson.security.*

def instance = Jenkins.getInstance()
instance.setCrumbIssuer(null)
instance.save()
println "CSRF Protection Disabled"
