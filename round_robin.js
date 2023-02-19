const { randomUUID } = require("crypto")

class Process {
	constructor(name, burstTime) {
		this.id = randomUUID()
		this.name = name
		this.burstTime = burstTime
		this.remainingTime = burstTime
	}
}

class ExecutionEntry {
	constructor(entryTime, process) {
		this.process = process
		this.entryTime = entryTime
		this.executionTimes = []
	}
}
class RoundRobinScheduler {
	constructor(options) {
		this.executionEntry = {}
		this.processes = []
		this.timeSlice = options?.timeSlice ?? 2
		this.verbose = options?.verbose ?? 0
		this.waitState = false
		this.notifyFunc = null
		this.clockTime = 0
		this.closed = false
		this.events = {}
		if (options?.waitIdle) {
			process.stdin.on("data", () => {})
		}
	}

	on(event, callback) {
		this.events[event] = callback
	}
	log(info, priority) {
		if (this.verbose > priority) {
			console.log(info)
		}
	}
	static log(process, type) {
		switch (type) {
			case "done":
				return `Done executing ${process.name}`
			default:
				return `Executing ${process.name} with ${process.remainingTime}s left`
		}
	}
	async start() {
		if (this.closed) {
			throw new Error("Scheduler is closed")
		}
		this.clockTimeIntervalId = setInterval(() => {
			this.clockTime += 0.5
		}, 498)
		let i = 0
		while (true) {
			if (this.processes.length === 0) {
				this.log("Scheduler is in idle state", 0)
				const onIdleCallback = this.events["idle"]
				if (onIdleCallback instanceof Function) {
					onIdleCallback()
				}
				await this.waitIdle()
				this.log("Leaving idle state", 0)
				i = 0
			}
			const currentProcess = this.processes[i]

			if (!currentProcess.remainingTime) {
				this.log("========================================================", 2)
				this.log(RoundRobinScheduler.log(currentProcess, "done"), 2)
				this.log(`Start time: ${this.executionEntry[currentProcess.id].entryTime}`, 2)
				this.log(this.executionEntry[currentProcess.id].executionTimes, 2)
				this.log("========================================================\n\n", 2)
				this.processes = this.processes.filter((process) => process.id !== currentProcess.id)
				i--
			} else {
				this.log(RoundRobinScheduler.log(currentProcess), 1)

				const entry = [this.clockTime, 0]
				const executedTime = await this.execute(currentProcess)
				currentProcess.remainingTime -= executedTime
				entry[1] = this.clockTime
				this.executionEntry[currentProcess.id].executionTimes.push(entry)
			}
			i = (i + 1) % this.processes.length
		}
	}

	async waitIdle() {
		this.waitState = true
		return new Promise((resolve) => {
			this.notifyFunc = resolve
		})
	}

	add(process) {
		if (this.closed) {
			throw new Error("Scheduler is closed")
		}
		this.log(`Adding ${process.name} with ${process.burstTime}s burst time`, 0)
		this.executionEntry[process.id] = new ExecutionEntry(this.clockTime, process)
		this.processes.push(process)

		if (this.waitState && this.notifyFunc instanceof Function) {
			this.notifyFunc()
			this.waitState = false
			this.notifyFunc = null
		}
	}

	async execute(process) {
		const timeSlice = Math.min(this.timeSlice, process.remainingTime)
		return new Promise((resolve) => {
			setTimeout(() => resolve(timeSlice), timeSlice * 1000)
		})
	}
	end() {
		if (this.waitState) {
			this.closed = true
			clearInterval(this.clockTimeIntervalId)
			process.stdin.pause()
		} else {
			throw new Error("Some processes are still executing")
		}
	}

	printExecutionStat() {
		console.log("\n===================== Processes Stat =======================")
		const waitTimes = []
		const serviceTimes = []
		Object.values(this.executionEntry).forEach((processExecuteEntry) => {
			const startTime = processExecuteEntry.entryTime
			const entries = processExecuteEntry.executionTimes
			const process = processExecuteEntry.process
			const waitTime = entries.reduce(
				(total, currentEntry) => {
					return [total[0] + currentEntry[0] - total[1], currentEntry[1]]
				},
				[0, startTime]
			)[0]
			const serviceTime = waitTime + process.burstTime

			waitTimes.push(waitTime)
			serviceTimes.push(serviceTime)
			console.log(`-> Process ${process.name}`)
			console.log(`Burst Time: ${process.burstTime}`)
			console.log(`Start Time: ${startTime}`)
			console.log(`Execution Times: ${entries.map(([start, end]) => `${start}-${end}`).join(", ")}`)
			console.log(`Wait Time: ${waitTime}s`)
			console.log(`Service Time: ${serviceTime}s`)
			console.log("")
		})
		console.log("===")
		console.log(`Average Waiting Time: ${waitTimes.reduce((t, c) => t + c, 0) / waitTimes.length}s`)
		console.log(
			`Average Service Time: ${serviceTimes.reduce((t, c) => t + c, 0) / serviceTimes.length}s`
		)
		console.log("===")
	}
}

const scheduler = new RoundRobinScheduler({ timeSlice: 2, verbose: 1, waitIdle: false })
scheduler.add(new Process("P1", 4))
scheduler.add(new Process("P2", 3))
scheduler.add(new Process("P3", 5))

process.stdin.on("data", (chunk) => {
	const input = chunk.toString().trim().split(" ")
	switch (input[0].toLowerCase()) {
		case "start":
			scheduler.start()
			break
		case "stat":
			scheduler.printExecutionStat()
			break
		case "clear":
			console.clear()
			break
		case "add":
			scheduler.add(new Process(input[1], +input[2]))
			break
		case "processes":
			for (const process of scheduler.processes) {
				console.log(`Process ${process.name} remains ${process.remainingTime}s`)
			}
			break
		case "close":
			process.exit(0)
		default:
			console.log("Invalid command")
	}
})
