import jenkins.model.*
import hudson.model.*

println "--- Starting 02-create-job.groovy (Force Pull Version) ---"

try {
    def instance = Jenkins.getInstance()
    def jobName = "codesync-build"
    def classLoader = instance.pluginManager.uberClassLoader
    
    // Check if WorkflowJob class is available
    try {
        classLoader.loadClass("org.jenkinsci.plugins.workflow.job.WorkflowJob")
    } catch (ClassNotFoundException e) {
        println "!!! WorkflowJob class not found yet. Skipping job creation."
        return
    }

    def job = instance.getItem(jobName)
    if (job == null) {
      println "Creating new WorkflowJob: ${jobName}"
      job = instance.createProject(classLoader.loadClass("org.jenkinsci.plugins.workflow.job.WorkflowJob"), jobName)
    } else {
      println "Updating existing job: ${jobName}"
    }

    // CLEAN UP
    job.removeProperty(hudson.model.ParametersDefinitionProperty)

    // Add parameters
    def paramDefs = [
      new StringParameterDefinition("REPO_URL", "", "Git repository URL"),
      new StringParameterDefinition("BRANCH", "main", "Branch to pull"),
      new StringParameterDefinition("ROOM_CODE", "", "Room Code")
    ]
    job.addProperty(new ParametersDefinitionProperty(paramDefs))

    def pipelineScript = '''
pipeline {
    agent any

    parameters {
        string(
            name: 'REPO_URL',
            defaultValue: '',
            description: 'Git repository URL (e.g. https://github.com/user/repo.git)'
        )
        string(
            name: 'BRANCH',
            defaultValue: 'main',
            description: 'Branch to pull'
        )
        string(
            name: 'ROOM_CODE',
            defaultValue: '',
            description: 'Room Code'
        )
    }

    environment {
        APP_PORT = '4567'
    }

    stages {
        stage('Validate Input') {
            steps {
                script {
                    if (!params.REPO_URL?.trim()) {
                        error "REPO_URL parameter is required."
                    }
                    echo "Repository : ${params.REPO_URL}"
                    echo "Branch     : ${params.BRANCH}"
                }
            }
        }

        stage('Check Tools') {
            steps {
                sh \'\'\'
                    echo "Checking tools..."
                    git --version
                    node --version
                    npm --version
                \'\'\'
            }
        }

        stage('Git Pull / Clone') {
            steps {
                sh \'\'\'
                    if [ -d app ]; then
                        echo "Cleaning up existing app directory..."
                        rm -rf app
                    fi
                    echo "Cloning repository..."
                    git clone ${REPO_URL} app
                    cd app
                    git checkout ${BRANCH} || echo "Branch ${BRANCH} not found, staying on default"
                \'\'\'
            }
        }

        stage('Install & Build') {
            steps {
                sh \'\'\'
                    cd app
                    npm install
                    npm run build || true
                \'\'\'
            }
        }

        stage('Serve') {
            steps {
                sh \'\'\'
                    cd app
                    echo "Stopping any existing process on port 4567..."
                    sudo fuser -k 4567/tcp || true
                    sleep 2
                    echo "Starting application on port 4567..."
                    export JENKINS_NODE_COOKIE=dontKillMe
                    nohup npx next start -H 0.0.0.0 -p 4567 > /tmp/app.log 2>&1 &
                    sleep 5
                    echo "Application started."
                    ps aux | grep next
                \'\'\'
            }
        }
    }

    post {
        failure {
            echo "Pipeline failed. Check logs above."
        }
        success {
            echo "Done — serving from ${params.REPO_URL} on port ${env.APP_PORT}"
        }
    }
}
'''

    def cpsFlowDefClass = classLoader.loadClass("org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition")
    job.setDefinition(cpsFlowDefClass.newInstance(pipelineScript, true))
    
    job.save()
    instance.save()
    println "--- Finished 02-create-job.groovy ---"
} catch (Exception e) {
    println "!!! ERROR in 02-create-job.groovy: ${e.getMessage()}"
    e.printStackTrace()
}
