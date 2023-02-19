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
class ShortestRemainingTimeFirstScheduler {
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

		while (true) {
			let currentProcess = this.getNextProcess()
			this.currentProcess = currentProcess
			if (!currentProcess) {
				this.log("scheduler entering idle state", 0)
				await this.waitIdle()
				currentProcess = this.getNextProcess()
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
		let min = null
		for (const process of this.processes) {
			if (!min) {
				min = process
			} else if (min.remainingTime > process.remainingTime) {
				min = process
			}
		}
		return min
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

		if (this.currentProcess) {
			let currentProcessTimeLeft = this.currentProcess.remainingTime
			currentProcessTimeLeft -= this.clockTime - this.currentProcessStartTime

			if (process.remainingTime < currentProcessTimeLeft) {
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

const scheduler = new ShortestRemainingTimeFirstScheduler({
	timeSlice: 2,
	verbose: 6,
	waitIdle: false,
})
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
scheduler.start()
setTimeout(() => {
	scheduler.add(new Process("P4", 1))
}, 1000)

setTimeout(() => {
	scheduler.add(new Process("P5", 1))
}, 5000)
