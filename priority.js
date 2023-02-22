const { randomUUID } = require("crypto")

class Process {
	constructor(name, burstTime, priority) {
		this.id = randomUUID()
		this.name = name
		this.burstTime = burstTime
		this.remainingTime = burstTime
		this.priority = priority
	}
}

class ExecutionEntry {
	constructor(entryTime, process) {
		this.process = process
		this.entryTime = entryTime
		this.executionTimes = []
	}
}
class PriorityScheduler {
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
		this.executionControl = null
		this.executionControlId = null
		this.currentProcess = null
		this.currentProcessStartTime = null

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

	setEntryTime() {
		for (const process of this.processes) {
			process.entryTime = this.clockTime
		}
	}
	async start() {
		if (this.closed) {
			throw new Error("Scheduler is closed")
		}
		this.setEntryTime()
		this.clockTimeIntervalId = setInterval(() => {
			this.clockTime += 0.5
		}, 498)

		while (true) {
			let currentProcess = this.getNextProcess()
			this.currentProcess = currentProcess
			if (!currentProcess) {
				this.log("scheduler entering idle state", 0)
				await this.waitIdle()
				currentProcess = this.getNextProcess()
				this.currentProcess = currentProcess
			}

			if (!currentProcess.remainingTime) {
				this.processes = this.processes.filter((process) => process.id !== currentProcess.id)
				continue
			}

			const entry = [this.clockTime, 0]
			this.currentProcessStartTime = this.clockTime
			const executedTime = await this.execute(currentProcess)
			entry[1] = this.clockTime
			this.executionEntry[currentProcess.id].executionTimes.push(entry)
			currentProcess.remainingTime -= executedTime
			this.currentProcess = null
			this.executionControl = null
			this.executionControlId = null
			this.currentProcessStartTime = null
		}
	}
	getNextProcess() {
		let maxPriority = null
		for (const process of this.processes) {
			if (!maxPriority) {
				maxPriority = process
			} else if (maxPriority.priority > process.priority) {
				maxPriority = process
			} else if (
				maxPriority.priority === process.priority &&
				maxPriority.entryTime > priority.entryTime
			) {
				maxPriority = process
			}
		}
		return maxPriority
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
		process.entryTime = this.clockTime
		this.log(`Adding ${process.name} with ${process.burstTime}s burst time`, 0)
		this.executionEntry[process.id] = new ExecutionEntry(this.clockTime, process)
		this.processes.push(process)

		if (this.waitState && this.notifyFunc instanceof Function) {
			this.notifyFunc()
			this.waitState = false
			this.notifyFunc = null
		}

		if (this.currentProcess) {
			let currentProcessTimeLeft = this.currentProcess.remainingTime
			currentProcessTimeLeft -= this.clockTime - this.currentProcessStartTime
			if (process.priority < this.currentProcess.priority) {
				clearTimeout(this.executionControlId)
				this.executionControl(this.clockTime - this.currentProcessStartTime)
			}
		}
	}

	async execute(process) {
		const timeSlice = process.remainingTime
		return new Promise((resolve) => {
			this.executionControl = resolve
			this.executionControlId = setTimeout(() => resolve(timeSlice), timeSlice * 1000)
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
			console.log(`Priority: ${process.priority}`)
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

const scheduler = new PriorityScheduler({
	verbose: 6,
	waitIdle: false,
})
scheduler.start()
scheduler.add(new Process("P1", 3, 3))

setTimeout(() => {
	scheduler.add(new Process("P2", 4, 2))
}, 1000)

setTimeout(() => {
	scheduler.add(new Process("P3", 6, 4))
}, 2000)

setTimeout(() => {
	scheduler.add(new Process("P4", 4, 6))
}, 3000)

setTimeout(() => {
	scheduler.add(new Process("P5", 2, 10))
}, 5000)

process.stdin.on("data", (chunk) => {
	const input = chunk.toString().trim().split(" ")
	switch (input[0].toLowerCase()) {
		case "stat":
			scheduler.printExecutionStat()
			break
		default:
			console.log("Invalid command")
	}
})
