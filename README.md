# Iglu scheduler
The Iglu Scheduler is responsible for managing [iglu builders](https://github.com/iglu-sh/builder) and their tasks in the Iglu ecosystem. It provides a way to schedule tasks for builders, ensuring that they are executed in a timely manner.
It's not really supposed to be run directly, but rather used with a [iglu controller](https://github.com/iglu-sh/controller).
## Installation
To run this project, you need to have [Bun](https://bun.sh) installed. You can install Bun by following the instructions on their website.
Then you can install the dependencies by running:
```bash
bun install
```
## Usage
You need a `.env` file in the root of the project with at least the following variables
```dotenv
DATABASE_URL=postgres://postgres:postgres@localhost:5432/cache#The URL of the cache database to connect too.
SCHEDULER_PORT=3008#The port the scheduler will listen on
SCHEDULER_INTERFACE=127.0.0.1#The interface the scheduler will listen on, can be an IP address or a hostname
SCHEDULER_AUTHKEY=a_very_cool_key#This key is used to authenticate requests from another service, keep it secret
LOG_LEVEL=INFO#May be DEBUG, INFO, WARNING, ERROR
```
> [!CAUTION]
> CAREFUL: The `DATABASE_URL` is used to connect to an **alreay initialized** Iglu Cache Database. The scheduler will not initialize the database for you, so make sure you have a running Iglu Cache Database and that you've run the **iglu-controller** at least once before starting the scheduler.

You can then run the scheduler with the following command:
```bash
bun run start 
```