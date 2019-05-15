# Kubeman Rocks! 
Slack Channel: #kubeman

## What's Kubeman?
Kubeman is a tool that aims to provide an easy way to view information in Kubernetes clusters and investigate issues related to Kubernetes and Istio. 

## How does it work?
Kubeman is offered as a desktop application that relies on your local saved kubernetes contexts (in kube config) to let you connect to up to 3 kubernetes clusters. Once connected to a cluster, you can view information from all namespaces that are available to your user account. Kubeman offers several recipes that can be executed against a cluster to view certain information or perform certain investigation.

# Why Kubeman?
Prior to Kubeman, there was no comprehensive tool available in the Kubernetes community to perform complex investigation against Kubernetes and Istio clusters. User would have to rely on terminal utilities like kubectl and istioctl to read information from clusters and connect the dots oneself. Investigating any non-trivial issue would result in running 10s of commands and cross-referencing information from multiple commands. Kubeman simplifies such investigation tasks by performing relevant cross-referencing and analysis of related information. Such pre-defined analysis tasks are offered as recipes.

# How to use it?
1. Either download the application binary (pre-built binaries offered for Mac and Win-64 OS), or get the source code and build it yourself (instructions below)
2. Use kuebctl (or another tool) to establish connection context for a cluster, so that the cluster context gets saved in your local kube config.
3. Run Kubeman application and click on "Select Cluster" button to select up to 3 clusters. You can optionally select one or more namespaces from the cluster selection dialog to limit your session to those namespaces for certain recipes.
4. You'll see a menus panel on the left side of the application window. You can select a recipe to run from the menus panel, or search for recipes by typing some keywords in the search field above the menus panel.
5. Some recipes may ask you to make further selections (e.g. select namespaces, services, pods, etc).
6. Once a recipe runs and produces output, you can use the search input field on the top of the output to look for specfic text in the recipe output.
7. Certain recipes allow you to enter commands/inputs, and they react on those inputs. E.g. "Find component by IP" recipe will wait till you input one or more IP addresses. In this case, the output search field also serves as a command input field for the recipe. To give input to a recipe, you type the input preceded by a "/". When a recipe supports command input, the text entered as "/<text>" is treated as input/command for the recipe instead of being used as search criteria.
8. Some recipes support reexecution. In such cases, once the recipe has been produced, you'll see a "ReRun" button at the bottom of the menus panel.
9. Some recipes support clearing its output once the output has been produced. In such cases, you'll see a "Clear" button at the bottom of the menus panel. Clearing output can be also be done by sending a "/clear" or "/c" command to such recipes.
10. You'll also see a "Stop" button at the bottom of the menus panel for most recipes. While Kubeman's recipes framework provides support for stopping recipes while they're running, not all recipes may be stopped once triggered. It's a best-effort feature.
11. Some recipes support executing it periodically in an automatic fashion. For such recipes, you'll see an "Auto Refresh" option at the bottom of the menus panel. If you select the "Auto Refresh" option, you can also specify a frequency for the auto refresh to happen. Recipes provide a default auto-refresh frequency value, and the auto refresh frequency cannot be set to a value lower than 5 seconds.
12. Kubeman supports "dark theme". You can switch to dark theme by using the selector at the left-bottom of the application window.


## To build and run the app
PreRequisite: Node.js and npm

1. Clone repo
2. 'npm install' - to install dependencies
3. 'npm run dev' - to run app in dev mode
4. 'npm run dist' - to package the app for distribution. This builds kubeman.app (mac) application in the dist/mac folder
