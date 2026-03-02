pipeline{
    agent any
    options {
        buildDiscarder(logRotator(numToKeepStr: '5')) 
    }
    stages{
        stage('Build'){
            steps{
                if (isUnix()) {
                    sh 'npm ci'
                    sh 'npm run build'
                } else {
                    bat 'npm ci'
                    bat 'npm run build'
                }
            }
        }
    }
}