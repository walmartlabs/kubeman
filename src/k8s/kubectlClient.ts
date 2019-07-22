/*
Copyright (c) Walmart Inc.

This source code is licensed under the Apache 2.0 license found in the
LICENSE file in the root directory of this source tree.
*/

import {exec, execSync, spawn} from 'child_process'
import fixPath from 'fix-path'
import { Cluster, ServiceInfo } from './k8sObjectTypes'

fixPath()

export default class KubectlClient {

  
  
  static async executeCommandSync(cmd: string) : Promise<string> {
    try {
      return execSync(cmd).toString()
    } catch(error) {
      return error.toString()
    }
  }

  static async executeCommand(cmd: string) : Promise<string> {
    let finishTimer
    let buffer: string = ''
    return new Promise((resolve, reject) => {
      exec(cmd, {maxBuffer: 32*1024*1024, windowsHide: true}, 
        (error, stdout, stderr) => {
          if(finishTimer) {
            clearTimeout(finishTimer)
          }
          if(error && error.toString().length > 0) {
            console.log(error)
            reject(error.toString())
          } else {
            buffer = buffer + (stdout || stderr || '')
          }
          finishTimer = setTimeout(() => resolve(buffer), 1000)
        }
      )
    })
  }
  static async runCommand(cmd: string, splitLines: boolean = true, separator: string = " ", joiner: string = ",", skipHeader: boolean = false) : Promise<string[][]> {
    const output = await this.executeCommand(cmd)
    if(output && output.length > 0) {
      const lines = splitLines ? output.split("\n").filter((line, index) => line.length > 0 && (!skipHeader || index>0)) : [output]
      let results = lines.map(line => line.split(separator).filter(field => field.length > 0))
      results = results.map(row => {
        for(let i = row.length-1; i > 0; i--) {
          if(row[i].endsWith(",") && row[i+1]) {
            row[i] = row[i] + " " + row[i+1]
            row[i+1] = ''
          }
        }
        return row.filter(field => field.length > 0)
      })
      return results
    } else {
      return []
    }
  }

  static async getTopNodes(cluster: Cluster) {
    return this.runCommand("kubectl top nodes --context "  + cluster.context)
  }

  static async getPods(cluster: Cluster, namespace?: string, ...filters: string[]) {
    let cmd = "kubectl get pods --field-selector=status.phase=Running --context "  + cluster.context +
              " -o jsonpath='{range .items[*]}{.metadata.namespace}{\" \"}{.metadata.name}{\" \"}{.status.podIP}{\" \"}{.status.hostIP}{\" \"}{.spec.nodeName}{\"\\n\"}{end}' "
              + (namespace ? " -n " + namespace : " --all-namespaces")
    if(filters.length > 0) {
      cmd = cmd + " | grep '" + filters.join("\\|") + "'"
    }
    const results = await this.runCommand(cmd)
    return results.map(item => {
      return {cluster: cluster.context, namespace: item[0], name: item[1], podIP: item[2], hostIP: item[3], nodeName: item[4]}
    })
  }

  static async getPodsByLabels(cluster: Cluster, namespace: string, labels: string) {
    let cmd = "kubectl get pods --field-selector=status.phase=Running --context "  + cluster.context +
              " -n " + namespace + " -l " + labels + " " +
              " -o jsonpath='{range .items[*]}{.metadata.namespace}{\" \"}{.metadata.name}{\" \"}{.status.podIP}{\" \"}{.status.hostIP}{\" \"}{.spec.nodeName}{\"\\n\"}{end}' "
    const results = await this.runCommand(cmd)
    return results.map(item => {
      return {cluster: cluster.context, namespace: item[0], name: item[1], podIP: item[2], hostIP: item[3], nodeName: item[4]}
    })
  }

  static async getPodsAndContainers(cluster: Cluster, namespace?: string, ...filters: string[]) {
    let cmd = "kubectl get pods --field-selector=status.phase=Running --context "  + cluster.context +
              " -o jsonpath='{range .items[*]}{.metadata.namespace}{\" \"}{.metadata.name}{\" \"}{.status.podIP}{\" \"}{.status.hostIP}{\" \"}{.spec.nodeName}{\" \"}{.spec.containers[*].name}{\"\\n\"}{end}' "
              + (namespace ? " -n " + namespace : " --all-namespaces")
    if(filters.length > 0) {
      cmd = cmd + " | grep '" + filters.join("\\|") + "'"
    }
    const results = await this.runCommand(cmd)
    return results.map(item => {
      return {cluster: cluster.context, namespace: item[0], name: item[1], podIP: item[2], hostIP: item[3], nodeName: item[4], containers: item.slice(5)}
    })
  }

  static async getPodsStatus(cluster: Cluster, namespace?: string, ...filters: string[]) {
    let cmd = "kubectl get pods -o wide --context "  + cluster.context +
              (namespace ? " -n " + namespace : " --all-namespaces")
    if(filters.length > 0) {
      cmd = cmd + " | grep '" + filters.join("\\|") + "'"
    }
    return this.runCommand(cmd)
  }

  static async getClusterNamespaces(cluster: Cluster) {
    const output = await this.executeCommand(
      "kubectl get namespaces -o jsonpath='{.items[*].metadata.name}' --context " + cluster.context)
    return output && output.length > 0 ? output.split(" ") : []
  }

  static async getServices(cluster: Cluster, namespace?: string, ...filters: string[]) : Promise<ServiceInfo[]> {
    let cmd = "kubectl get services --context "  + cluster.context +
              " -o jsonpath='{range .items[*]}{\"\\n\"}{.metadata.namespace}{\" \"}{.metadata.name}{\" \"}{.spec.clusterIP}{\" \"}{range .spec.ports[*]}{.port}{\" \"}{end}{end}' "
              + (namespace ? " -n " + namespace : " --all-namespaces")
    if(filters.length > 0) {
      cmd = cmd + " | grep '" + filters.join("\\|") + "'"
    }
    const results = await this.runCommand(cmd)
    return results.map(item => {
      return {cluster: cluster.context, namespace: item[0], name: item[1], clusterIP: item[2], ports: item.slice(3)}
    })
  }

  static getPodLogs(cluster: Cluster, namespace: string, pod: string, container: string, 
                    tail: boolean, lines: number, ...filters: string[]) {
    const options = ["logs", "--context", cluster.context, "-n", namespace, pod, "-c", container]
    lines > 0 && options.push("--tail="+lines)
    tail && options.push("-f")
    const logProcess = spawn("kubectl", options)
    let stdout = logProcess.stdout
    let stderr = logProcess.stderr
    if(filters.length > 0) {
      const grep = spawn("grep", [filters.join("\\|")])
      logProcess.stdout.on("data", (data) => {
        grep.stdin.write(data)
      })
      logProcess.stderr.on("data", (data) => {
        grep.stdin.write(data)
      })
      logProcess.on('close', (code) => {
        grep.stdin.end();
      })
      stdout = grep.stdout
    }
    return {logProcess, stdout, stderr}
  }

  static async getHPAStatus(cluster: Cluster, namespace?: string, ...filters: string[]) {
    let cmd = "kubectl get hpa --context "  + cluster.context + 
                (namespace ? " -n " + namespace : " --all-namespaces")
    if(filters.length > 0) {
      cmd = cmd + " | grep '" + filters.join("\\|") + "'"
    }
    const hpaStatus = await this.runCommand(cmd)
    if(namespace) {
      cmd = "kubectl get replicaset --context "  + cluster.context + " -n " + namespace
      if(filters.length > 0) {
        cmd = cmd + " | grep '" + filters.join("\\|") + "'"
      }
      const replicasetStatus = await this.runCommand(cmd)
      return {hpaStatus, replicasetStatus}
    } else {
      return {hpaStatus}
    }
  }

  static async executePodCommand(cluster: Cluster, namespace: string, pod: string, container: string, command: string) {
    await this.sleep(100)
    let cmd = "kubectl exec --context "  + cluster.context + " -n " + namespace +
              " " + pod + " -c " + container + " -- " + command
    return this.executeCommand(cmd)
  }

  static async sleep(ms) {
    await new Promise(resolve => setTimeout(resolve, ms))
  }
}