pipeline {
    agent any

    tools {
        nodejs 'node18'
    }

    environment {
        ROOM_CODE    = "${params.ROOM_CODE}"
        FRONTEND_IP  = '10.0.1.11'
        REPO_DIR     = "/repos/${ROOM_CODE}"
        BUILD_DIR    = "/builds/${ROOM_CODE}"
        SERVE_PORT   = '4567'
    }

    stages {
        stage('Pull Latest Code') {
            steps {
                sshagent(['frontend-ssh-key']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no ubuntu@${FRONTEND_IP} \
                          "cd ${REPO_DIR} && git pull origin main"
                    '''
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                sshagent(['frontend-ssh-key']) {
                    sh '''
                        ssh ubuntu@${FRONTEND_IP} \
                          "cd ${REPO_DIR} && if ! command -v pnpm &> /dev/null; then sudo npm install -g pnpm; fi && pnpm install --silent"
                    '''
                }
            }
        }

        stage('Build') {
            steps {
                sshagent(['frontend-ssh-key']) {
                    sh '''
                        ssh ubuntu@${FRONTEND_IP} \
                          "cd ${REPO_DIR} && pnpm run build"
                    '''
                }
            }
        }

        stage('Serve Build Output') {
            steps {
                sshagent(['frontend-ssh-key']) {
                    sh '''
                        ssh ubuntu@${FRONTEND_IP} \
                          "fuser -k ${SERVE_PORT}/tcp || true;
                           mkdir -p ${BUILD_DIR};
                           cp -r ${REPO_DIR}/out ${BUILD_DIR}/ 2>/dev/null || \
                           cp -r ${REPO_DIR}/.next ${BUILD_DIR}/ 2>/dev/null || \
                           cp -r ${REPO_DIR}/dist ${BUILD_DIR}/ 2>/dev/null || \
                           cp -r ${REPO_DIR}/build ${BUILD_DIR}/ 2>/dev/null;
                           cd ${BUILD_DIR} && npx serve . -l ${SERVE_PORT} &"
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "Build deployed to http://${FRONTEND_IP}:${SERVE_PORT}"
        }
        failure {
            echo "Build failed for room ${ROOM_CODE}"
        }
    }
}
