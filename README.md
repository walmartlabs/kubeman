![Kubeman Logo](/static/kubeman-logo.png)
# Kubeman Rocks!
Slack Channel: #kubeman

## What's Kubeman?
Kubeman is a tool that attempts to make it easier to find information from Kubernetes clusters, and to investigate issues related to Kubernetes and Istio.

## Why Kubeman?
While kubectl is a must-have utility for working with Kubernetes clusters, it leaves a lot to the user when it comes to investigating complex issues related to Kubernetes and Istio.
Investigating any non-trivial issue may involve running dozens of commands and cross-referencing information from multiple commands, retaining a lot of context and connecting the dots in one's head. Kubeman simplifies such investigation tasks by performing relevant cross-referencing and analysis of related information, so that the user doesn't have to do the heavy-lifting. Such pre-defined analysis tasks are offered as recipes.

## How does it work?
Kubeman is offered as a desktop application that uses your local kube config to connect to clusters of your choice. Once connected, you can view and analyze information from all namespaces that are available to your user account. Kubeman offers various recipes ranging from those that can give you a summary overview of a cluster, to those that can analyze and correlate configurations across multiple clusters.

## How to use it?
### Installation
You can either choose to download a pre-built binary from the github releases, or build the application yourself (see below). Pre-built binaries are available for Mac (dmg), Win64 (exe) and Linux (appimage) platforms.

### Usage
See: [Kubeman User Guide](/userGuide.md)

## To build and run the app
PreRequisite: Node.js and npm

1. Clone repo
2. 'npm install' - to install dependencies
3. 'npm run dev' - to run app in dev mode
4. 'npm run dist' - to package the app for distribution. This builds kubeman.app (mac) application in the dist/mac folder
