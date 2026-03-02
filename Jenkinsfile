pipeline{
    agent any
    options {
        buildDiscarder(logRotator(numToKeepStr: '5')) 
    }
    stages{
        stage('Build Docker app'){
            when {
                branch 'main'
            }
            steps{
                script {
                    if (isUnix()) {
                        withCredentials([string(credentialsId: 'DATABASE_URL', variable: 'DATABASE_URL')]) {
                            sh 'docker build --build-arg DATABASE_URL="${DATABASE_URL}" -t ganuthebabu/MINI_PROG:latest .'
                        }
                    }else {
                        withCredentials([string(credentialsId: 'DATABASE_URL', variable: 'DATABASE_URL')]) {
                            sh 'docker build --build-arg DATABASE_URL="${DATABASE_URL}" -t ganuthebabu/MINI_PROG:latest .'
                        }
                    }
                }
            }
        }
        stage('Push'){
            when {
                branch 'main'
            }
            steps{
                script {
                    withCredentials([usernamePassword(credentialsId: 'DOCKER_CREDS', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        if (isUnix()) {
                            sh 'echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin'
                            sh 'docker push ganuthebabu/MINI_PROG:latest'
                            sh 'docker logout'
                        } else {
                            bat 'docker login -u %DOCKER_USER% -p %DOCKER_PASS%'
                            bat 'docker push ganuthebabu/MINI_PROG:latest'
                            bat 'docker logout'
                        }
                    }
                }   
            }
        }
    }
}