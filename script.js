'use strict';

class Model {
  constructor() {
    this.vars = []
    this.varsEcart = [] // TODO: passer en Float32Array ?
    this.constraints = [] // TODO: ne plus utilise constraints.length, voir quelle variable virer, opti tableau ?
    this.nbVars = 0
    this.nbVarEcart = 0
    this.optimizationType = undefined

    this.tableau = []
    this.vectorVars = undefined
    this.vectorB = undefined // TODO: rename second member ou similaire
    this.vectorBase = undefined

    this.maxIteration = 10
  }

  addVar = variable => {
    this.vars.push({
      id: variable.id || this.nbVars, // voir utilite
      name: variable.name || undefined,
      coeff: variable.coeff || 0,
      value: 0 // voir utilite
    })
    this.nbVars++
  }
  addVars = variables => { } // TODO:

  addConstraint = constraint => this.constraints.push(constraint)
  addConstraints = constraints => { } // TODO:

  countNbVarEcart = () => {
    for (let i = 0; i < this.constraints.length; i++) {
      if (this.constraints[i].constraint != "equal") {
        this.varsEcart.push(this.nbVarEcart + this.nbVars)
        this.nbVarEcart++
      }
    }
  }

  compile = optimizationType => { // TODO:  Voir si on peut virer variables d'écart quand contrainte égale
    // TODO: rename les i, j dégeu
    if ( optimizationType != "minimize" && optimizationType != "maximize") {
      console.warn(`Please pick between \'maximize\' and \'minimize\', not \'${optimizationType}\'`)
      return
    }
    else {
      this.optimizationType = optimizationType
      if ( this.optimizationType === "minimize" ) {
        for ( let i = 0; i < this.nbVars; i++ ) {
          this.vars[i].coeff = -this.vars[i].coeff
        }
      }
    }
    this.countNbVarEcart()
    for (let i = 0; i < this.constraints.length; i++) { // TODO: utiliser arr.map au lieu des for dégeu ?
      let sign = (this.constraints[i].constraint === "inf" || this.constraints[i].constraint === "equal") ? 1 : - 1
      this.tableau[i] = new Float32Array(this.nbVars + this.nbVarEcart)
      for (let j = 0; j < this.nbVars; j++) {
        this.tableau[i][j] = sign * this.constraints[i].equation[j] // Ajout variables du problème
      }
      this.tableau[i][i + this.nbVars] = 1 // Ajout variables d'écart
    }
    this.vectorVars = new Float32Array(this.nbVars + this.nbVarEcart)
    for (let i = 0; i < this.nbVars; i++) {
      this.vectorVars[i] = this.vars[i].coeff
    }
    this.vectorB = new Float32Array(this.constraints.length)
    for (let i = 0; i < this.constraints.length; i++) {
      let sign = (this.constraints[i].constraint === "inf" || this.constraints[i].constraint === "equal") ? 1 : - 1
      this.vectorB[i] = sign * this.constraints[i].b
    }

    this.vectorBase = new Array(this.constraints.length) // Creation de la solution pour une base réalisable
    for (let i = 0; i < this.constraints.length; i++) { // TODO: remplacer par longueur du nb de var ecart plutot car quand ya des contraintes égales on a pas d'écart
      this.vectorBase[i] = this.varsEcart[i]
    }
  }

// TODO: tester un edge case avec une equation de type égalite
  optimize = () => {
    let nbIteration = 0
    console.log(this.vectorB)
    console.log(this.vectorVars)
    console.log(this.vectorBase)
    console.table(this.tableau)
    while( this.vectorVars[this.argMax(this.vectorVars)] > 0 && nbIteration < this.maxIteration) { // TODO: ajouter un max iteration dans le while
      nbIteration++
      let enteringVarIndex = this.argMax(this.vectorVars)
      let leavingVarIndex = this.leavingVar(enteringVarIndex)

      this.vectorBase[leavingVarIndex] = enteringVarIndex

      let pivot = this.tableau[leavingVarIndex][enteringVarIndex]

      let copyVectorB = [...this.vectorB]
      let copyVectorVars = [...this.vectorVars]
      let copyTableau = this.copyTableau()
      for (let i = 0; i < this.vectorB.length; i++) { // Update vectorB
        if (i === leavingVarIndex) this.vectorB[i] = copyVectorB[i] / pivot // TODO:  voir division par 0
        else this.vectorB[i] = copyVectorB[i] - (this.tableau[i][enteringVarIndex] * copyVectorB[leavingVarIndex]) / pivot // TODO:  voir division par 0
      }
      for (let i = 0; i < this.vectorVars.length; i++) { // Update objective
        this.vectorVars[i] = copyVectorVars[i] - (copyVectorVars[enteringVarIndex] * this.tableau[leavingVarIndex][i]) / pivot // TODO:  voir division par 0
      }

      for (let i = 0; i < this.tableau.length; i++) { // Update tableau
        for (let j = 0; j < this.tableau[i].length; j++) {
          if (i === leavingVarIndex) this.tableau[i][j] = copyTableau[i][j] / pivot // TODO:  voir division par 0
          else this.tableau[i][j] = copyTableau[i][j] - (copyTableau[i][enteringVarIndex] * copyTableau[leavingVarIndex][j]) / pivot // TODO:  voir division par 0
        }
      }
      console.log("///// NEW ITERATION RESULT :")
      console.log(this.vectorB)
      console.log(this.vectorVars)
      console.log(this.vectorBase)
      console.table(this.tableau)

      this.computeObjectiveValue()
    }

  }

  computeObjectiveValue = () => {
    let solutionVector = new Float32Array(this.nbVars + this.nbVarEcart)
    for (let i = 0; i < solutionVector.length; i++) {
      let indexVectorB = this.vectorBase.findIndex(x => x === i)
      if (indexVectorB != -1) solutionVector[i] = this.vectorB[indexVectorB]
      else solutionVector[i] = 0
    }
    console.log("Optimum Solution : ", solutionVector)
    let coefficients = new Float32Array(this.nbVars + this.nbVarEcart)
    for (let i = 0; i < this.nbVars; i++) coefficients[i] = this.vars[i].coeff
    let optimum = this.dot(solutionVector, coefficients)
    console.log("Optimum value of Objective function : ", optimum)
  }

  dot = (vector1, vector2) => {
    let result = 0
    for (let i = 0; i < vector1.length; i++) {
      result += vector1[i] * vector2[i]
    }
    return result
  }

  leavingVar = enteringVarIndex => {
    let tmp = new Float32Array(this.vectorB.length)
    for (let i = 0; i < this.vectorB.length; i++) { // TODO: faire un check sur division par 0 :
      if (this.tableau[i][enteringVarIndex] === 0 || this.tableau[i][enteringVarIndex] < 0) tmp[i] = -1 // Les négatifs ne nous intéressent pas
      else tmp[i] = this.vectorB[i] / this.tableau[i][enteringVarIndex]
    }
    // console.log(tmp)
    let index = this.argMin(tmp)
    return index
  }

  argMax = vector => {
    let indexMax = 0
    let valeurMax = 0 // TODO: Voir si 0 ou - infini à utiliser
    for (let i = 0; i < vector.length; i++) {
      if (vector[i] > valeurMax) {
        indexMax = i
        valeurMax = vector[i]
      }
    }
    return indexMax
  }

  argMin = vector => {
    let indexMin = 0
    let valeurMin = 100000 // TODO: Voir si 0 ou + infini à utiliser
    for (let i = 0; i < vector.length; i++) {
      if (vector[i] < valeurMin && vector[i] >= 0) { // TODO: voir >, ou >= ( >= à la base mais voir le b === -0 à prendre ou pas ?)
        indexMin = i
        valeurMin = vector[i]
      }
    }
    return indexMin
  }



  copyTableau = () => {
    let arr = []
    for (let i = 0; i < this.tableau.length; i++) {
      arr[i] = new Float32Array(this.tableau[i].length)
      for (let j = 0; j < this.tableau[i].length; j++) {
        arr[i][j] = this.tableau[i][j]
      }
    }
    return arr
  }
}



let m = new Model()

// exemple 1
// m.addVar({coeff: 1})
// m.addVar({coeff: 2})
// m.addConstraint({equation: [1, 3], constraint: "inf", b: 21})
// m.addConstraint({equation: [-1, 3], constraint: "inf", b: 18})
// m.addConstraint({equation: [1, -1], constraint: "inf", b: 5})

// m.addConstraints({
//   equations: [
//     [1, 3],
//     [-1, 3],
//     [1, -1]
//   ],
//   constraints: ["inf", "inf", "inf"],
//   bs: [21, 18, 5]
// })


// exemple 2
// m.addVar({coeff: 1})
// m.addVar({coeff: -3})
// m.addConstraint({equation: [3, -2], constraint: "inf", b: 7})
// m.addConstraint({equation: [-1, 4], constraint: "inf", b: 9})
// m.addConstraint({equation: [-2, 3], constraint: "inf", b: 6})

// Exemple 3 égalités
// TODO: pivot === 0 => division by 0 proleme
// m.addVar({coeff: 3})
// m.addConstraint({equation: [2, 0], constraint: "inf", b: 20})

// Exemple 4
// m.addVar({coeff: 1})
// m.addVar({coeff: 2})
// m.addConstraint({equation: [1, 1], constraint: "inf", b: 12})
// m.addConstraint({equation: [3, -1], constraint: "sup", b: 6})
// m.addConstraint({equation: [-1, 4], constraint: "sup", b: 8})
// m.addConstraint({equation: [0, 1], constraint: "inf", b: 6})

// Exemple 5 non borné
// m.addVar({coeff: 1})
// m.addVar({coeff: 2})
// m.addConstraint({equation: [3, -2], constraint: "sup", b: 6})
// m.addConstraint({equation: [-1, 4], constraint: "sup", b: 8})

// Exemple 6 placements
// for ( let i = 0; i < 7 ; i++ ) m.addVar({coeff: 1.05})
// for ( let i = 0; i < 6 ; i++ ) m.addVar({coeff: 1.12})
// for ( let i = 0; i < 5 ; i++ ) m.addVar({coeff: 1.19})
//
// //1
// m.addConstraint({equation: [1,0,0,0,0,0,0, 1,0,0,0,0,0, 1,0,0,0,0], constraint: "inf", b: 1000})
// // m.addConstraint({equation: [1,0,0,0,0,0,0, 1,0,0,0,0,0, 1,0,0,0,0], constraint: "sup", b: 1000})
// //2
// m.addConstraint({equation: [-1,1,0,0,0,0,0, -1,1,0,0,0,0, -1,1,0,0,0], constraint: "inf", b: 0})
// // m.addConstraint({equation: [1,-1,0,0,0,0,0, 1,-1,0,0,0,0, 1,-1,0,0,0], constraint: "sup", b: 0})
// //3
// m.addConstraint({equation: [0,-1,1,0,0,0,0, 0,-1,1,0,0,0, 0,-1,1,0,0], constraint: "inf", b: 0})
// // m.addConstraint({equation: [0,1,-1,0,0,0,0, 0,1,-1,0,0,0, 0,1,-1,0,0], constraint: "sup", b: 0})
// //4
// m.addConstraint({equation: [0,0,-1,1,0,0,0, 0,0,-1,1,0,0, 0,0,-1,1,0], constraint: "inf", b: 0})
// // m.addConstraint({equation: [0,0,1,-1,0,0,0, 0,0,1,-1,0,0, 0,0,1,-1,0], constraint: "sup", b: 0})
// //5
// m.addConstraint({equation: [0,0,0,-1,1,0,0, 0,0,0,-1,1,0, 0,0,0,-1,1], constraint: "inf", b: 0})
// // m.addConstraint({equation: [0,0,0,1,-1,0,0, 0,0,0,1,-1,0, 0,0,0,1,-1], constraint: "sup", b: 0})
// //6
// m.addConstraint({equation: [0,0,0,0,-1,1,0, 0,0,0,0,-1,1, 0,0,0,0,-1], constraint: "inf", b: 0})
// // m.addConstraint({equation: [0,0,0,0,1,-1,0, 0,0,0,0,1,-1, 0,0,0,0,1], constraint: "sup", b: 0})
// //7
// m.addConstraint({equation: [0,0,0,0,0,-1,1, 0,0,0,0,0,-1, 0,0,0,0,0], constraint: "inf", b: 0})
// // m.addConstraint({equation: [0,0,0,0,0,1,-1, 0,0,0,0,0,1, 0,0,0,0,0], constraint: "sup", b: 0})
m.addVar({coeff: 1.05})
m.addVar({coeff: 1.05})
m.addVar({coeff: 1.05})
m.addVar({coeff: 1.10})
m.addConstraint({equation: [1    ,0    ,0,0], constraint: "inf", b: 1000})
m.addConstraint({equation: [-1.05,1    ,0,1], constraint: "inf", b: 0})
m.addConstraint({equation: [0    ,-1.05,1,-1.1], constraint: "inf", b: 0})

/////////////////////////////////////////
m.compile("maximize")
m.optimize()
console.log(m)
