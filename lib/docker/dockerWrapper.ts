import Docker from "dockerode";
import Logger from "@iglu-sh/logger";
import type {RedisClientType} from "redis";

export default class DockerWrapper{
    private static DockerClient:Docker;
    constructor(DOCKER:Docker) {
        Logger.info(`Setting Docker Client`)
        DockerWrapper.DockerClient = DOCKER;
    }
    static getClient():Docker{
        return DockerWrapper.DockerClient
    }
    static async setup(){
        Logger.debug(`Setting Docker Client`)
        Logger.debug('Creating Docker Network')
        const info = await DockerWrapper.DockerClient.listNetworks()
        if(info.filter((nw)=>{return nw.Name === "iglu-nw"}).length === 0) {
            Logger.info('Creating Docker network "iglu-nw"');
            await DockerWrapper.DockerClient.createNetwork({
                Name: 'iglu-nw',
                CheckDuplicate: true,
                Driver: 'bridge',
            }).catch((error) => {
                Logger.error(`Failed to create Docker network "iglu-nw": ${error.message}`);
            });
        }
        else{
            Logger.debug('Docker Network exists, not creating')
        }
    }
    // Starts a builder with the given id
    static async startBuilder(id:string, builderConfigID:number, jobID:string, release:string, log_level:string){
        // Check if a builder with that name already exists
        const containers = await DockerWrapper.DockerClient.listContainers()
        const duplicateNameContainers = containers.filter((container)=>{
            const containerNameLength = container.Names.filter((name)=>{
                return name.includes(id)
            })
            if(containerNameLength.length > 0){
                return true
            }
            return false
        })
        if(duplicateNameContainers.length > 0){
            throw new Error(`Could not start container with id: ${id}, duplicate name`);
        }
        // We need to differentiate between darwin and everything else, as darwin does not have support for docker routes
        // This means that we need to bind the ports to localhost instead (and generate random ones)
        if(process.platform === 'darwin'){
            //TODO: Generate random port here
            Logger.info(`Starting Docker container for builder config ID ${builderConfigID} (jobID: ${jobID}) on Darwin platform`);
            DockerWrapper.DockerClient.run(`ghcr.io/iglu-sh/iglu-builder:${release}`, [], [], {Tty: false, name: id, HostConfig:{NetworkMode:'iglu-nw', PortBindings: {"3000/tcp": [{"HostPort":"30008", "HostIP": "0.0.0.0"}]}}, Env: [`LOG_LEVEL=${log_level}`]}, async (err)=>{
                // TODO: This does not throw a catchable error for some reason
                if(err){
                    Logger.error(`Error starting Docker container for builder config ID ${builderConfigID} (jobID: ${jobID}): ${err.message}`);
                    throw new Error(`Error starting Docker container for builder config ID ${builderConfigID}: ${err.message}`);
                }
            })
            return
        }

        DockerWrapper.DockerClient.run(`ghcr.io/iglu-sh/iglu-builder:${release}`, [], [], {Tty: false, name: id, HostConfig:{NetworkMode:'iglu-nw'}, Env: [`LOG_LEVEL=${log_level}`]}, async (err)=>{ if(err){
                Logger.error(`Error starting Docker container for builder config ID ${builderConfigID} (jobID: ${jobID}): ${err.message}`);
                throw new Error(`Error starting Docker container for builder config ID ${builderConfigID}: ${err.message}`);
            }
        })
    }
    static async stopBuilder(id:string){
        // Stops a builder with the given id
        const container = DockerWrapper.DockerClient.getContainer(id)
        // Check if the container exists and if it's running
        const containerInfo = await container.inspect().catch((err)=>{
            Logger.error(`Could not inspect container with id: ${id}, error: ${err.message}`);
        })

        if(!containerInfo || !containerInfo.State.Running){
            Logger.debug(`Container with id: ${id} is not running, nothing to stop`);
            return
        }
        await container.stop().catch((err)=>{
            Logger.debug(`Could not stop container with id: ${id}, error: ${err.message}`);
        })
    }
}