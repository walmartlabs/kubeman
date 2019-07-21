![Kubeman Logo](/static/kubeman-logo.png)
# Kubeman Rocks!
Slack Channel: #kubeman

## What's Kubeman?
Kubeman is a tool that aims to provide an easy way to view information in Kubernetes clusters and investigate issues related to Kubernetes and Istio. 

## How does it work?
Kubeman is offered as a desktop application that relies on your local saved kubernetes contexts (in kube config) to let you connect to up to 3 kubernetes clusters. Once connected to a cluster, you can view information from all namespaces that are available to your user account. Kubeman offers several recipes that can be executed against a cluster to view related information or perform certain investigation.

## Why Kubeman?
Prior to Kubeman, there was no comprehensive tool available in the Kubernetes community to perform complex investigation against Kubernetes and Istio clusters. User would have to rely on terminal utilities like kubectl and istioctl to read information from clusters and connect the dots oneself. Investigating any non-trivial issue would result in running 10s of commands and cross-referencing information from multiple commands. Kubeman simplifies such investigation tasks by performing relevant cross-referencing and analysis of related information. Such pre-defined analysis tasks are offered as recipes.

## How to use it?
See: [Kubeman User Guide](/userGuide.md)

## To build and run the app
PreRequisite: Node.js and npm

1. Clone repo
2. 'npm install' - to install dependencies
3. 'npm run dev' - to run app in dev mode
4. 'npm run dist' - to package the app for distribution. This builds kubeman.app (mac) application in the dist/mac folder
