// Registers the scheduler to the controller
import Logger from "@iglu-sh/logger";
import * as process from "node:process";

export async function register(KEY:string, logger:Logger){
    if(!process.env.CONTROLLER_ADDRESS){
        Logger.error("Controller address not set in environment variables");
        process.exit(1)
        return;
    }
    if(!process.env.CONTROLLER_ACCESS_KEY){
        Logger.error("Controller access key not set in environment variables");
        process.exit(1)
        return;
    }
    if(!process.env.SCHEDULER_ADDRESS || !process.env.SCHEDULER_PORT){
        Logger.error("Scheduler address or port not set in environment variables");
        process.exit(1)
        return;
    }
    if(!KEY){
        Logger.error("No KEY provided for registration");
        process.exit(1)
        return;
    }

    Logger.info("------------- Iglu Scheduler Registration -------------");
    Logger.info(`Registering scheduler with the following details:`)
    Logger.info(`Node Name: ${process.env.SCHEDULER_NAME || "Iglu Scheduler"}`);
    Logger.info(`Node PSK: ${KEY}`);
    Logger.info(`Node Address: ${process.env.SCHEDULER_ADDRESS || "localhost"}`);
    Logger.info(`Node Port: ${process.env.SCHEDULER_PORT || "3000"}`);
    Logger.info(`Node Arch: ${process.arch}`);
    Logger.info(`Node OS: ${process.platform}`);
    Logger.info(`Node Max Jobs: ${process.env.SCHEDULER_MAX_JOBS || "10"}`);
    Logger.info(`Controller Address: ${process.env.CONTROLLER_ADDRESS}`);
    Logger.info("------------------------------------------------------");

    // Make a request to the controller to register the scheduler
    const response = await fetch(
        `${process.env.CONTROLLER_ADDRESS}/api/v1/node/register`
        , {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authentication": process.env.CONTROLLER_ACCESS_KEY
            },
            body: {
                node_name: process.env.SCHEDULER_NAME || "Iglu Scheduler",
                node_psk: KEY,
                node_address: process.env.SCHEDULER_ADDRESS || "localhost",
                node_port: parseInt(process.env.SCHEDULER_PORT || "3000", 10),
                node_version: process.env.SCHEDULER_VERSION || "unknown",
                node_arch: process.arch,
                node_os: process.platform,
                node_max_jobs: parseInt(process.env.SCHEDULER_MAX_JOBS || "10", 10)
            }
        }
    )
}
