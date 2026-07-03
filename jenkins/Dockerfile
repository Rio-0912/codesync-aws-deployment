FROM jenkins/jenkins:lts

USER root

# Install Node.js and Docker CLI
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs docker.io

# Disable setup wizard
ENV JAVA_OPTS="-Djenkins.install.runSetupWizard=false"

USER jenkins

# Install required plugins
RUN jenkins-plugin-cli --plugins "git workflow-aggregator nodejs ssh-agent"

# Copy groovy init scripts
COPY init.groovy.d/ /usr/share/jenkins/ref/init.groovy.d/
