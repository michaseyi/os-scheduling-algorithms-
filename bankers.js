class BankersAlgorithm {
	constructor(state) {
		this.state = state
	}

	static computeNeedMatrix(allocation, max) {
		return max.map((maxResource, i) => {
			return maxResource.map((v, j) => v - allocation[i][j])
		})
	}
	static lessThanOrEqual(arr1, arr2) {
		return arr1.every((v, i) => v <= arr2[i])
	}

	static getNextExecutableProcess(processes, available, safeSequence, need, startPos) {
		for (let i = startPos; i < processes.length; i++) {
			const process = processes[i]
			if (!safeSequence.includes(process)) {
				if (BankersAlgorithm.lessThanOrEqual(need[i], available)) {
					return [process, i + 1]
				}
			}
		}
		for (let i = 0; i < startPos; i++) {
			const process = processes[i]
			if (!safeSequence.includes(process)) {
				if (BankersAlgorithm.lessThanOrEqual(need[i], available)) {
					return [process, i + 1]
				}
			}
		}
		return null
	}

	getSafeExecutionSequence() {
		const safeSequence = []
		let { allocation: allocationMatrix, max: maxMatrix, processes, available } = this.state
		const needMatrix = BankersAlgorithm.computeNeedMatrix(allocationMatrix, maxMatrix)
		let nextSearchIndex = 0
		while (safeSequence.length < processes.length) {
			const result = BankersAlgorithm.getNextExecutableProcess(
				processes,
				available,
				safeSequence,
				needMatrix,
				nextSearchIndex
			)

			if (!result) {
				throw new Error("The system is not safe.")
			}

			const [nextExecutableProcess, nextSearchPos] = result
			nextSearchIndex = nextSearchPos
			safeSequence.push(nextExecutableProcess)
			const processIndex = processes.findIndex((p) => p === nextExecutableProcess)
			available = available.map((v, i) => v + allocationMatrix[processIndex][i])
		}
		return safeSequence.join(" -> ")
	}
}

// Examples that were given in class

const example1 = {
	processes: ["P0", "P1", "P2", "P3", "P4"],
	resources: ["A", "B", "C"],
	allocation: [
		[0, 1, 0],
		[2, 0, 0],
		[3, 0, 2],
		[2, 1, 1],
		[0, 0, 2],
	],
	max: [
		[7, 5, 3],
		[3, 2, 2],
		[9, 0, 2],
		[2, 2, 2],
		[4, 3, 3],
	],
	available: [3, 3, 2],
}

const example2 = {
	processes: ["P0", "P1", "P2", "P3", "P4"],
	resources: ["A", "B", "C", "D"],
	allocation: [
		[0, 0, 1, 2],
		[1, 0, 0, 0],
		[1, 3, 5, 4],
		[0, 6, 3, 2],
		[0, 0, 1, 4],
	],

	max: [
		[0, 0, 1, 2],
		[1, 7, 5, 0],
		[2, 3, 5, 6],
		[0, 6, 5, 2],
		[0, 6, 5, 6],
	],
	available: [1, 5, 2, 0],
}

try {
	const scheduler = new BankersAlgorithm(example2)
	console.log(scheduler.getSafeExecutionSequence())
} catch (err) {
	console.log(err.message)
}
