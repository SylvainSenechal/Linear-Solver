'use strict';

// TODO: voir s'il faut ajouter les contraintes Xi > 0
// TODO: passer en module la librairie
// TODO: rename les i, j dégeu
// TODO: utiliser arr.map au lieu des for dégeu ?

class Model {
  constructor() {
    this.vars = []
    this.varsEcart = [] // TODO: passer en Float64Array ?
    this.varsArtificial = []
    this.constraints = [] // TODO: ne plus utilise constraints.length, voir quelle variable virer, opti tableau ?
    this.nbVars = 0
    this.nbVarEcart = 0
    this.nbVarArtificials = 0
    this.optimizationType = undefined

    this.tableau = []
    this.vectorVars = undefined
    this.vectorB = undefined
    this.vectorBase = undefined

    this.maxIteration = 50
    this.infinity = -10000000
  }

  addVar = variable => {
    this.vars.push({
      id: this.nbVars, // voir utilite
      name: variable.name || undefined,
      coeff: variable.coeff || 0,
    })
    this.nbVars++
  }
  addVars = variables => {
    for ( let i = 0; i < variables.coeffs.length; i++ ) {
      this.vars.push({
        id: this.nbVars, // voir utilite
        name: variables.names === undefined ? undefined : variables.names[i],
        coeff: variables.coeffs[i] || 0,
      })
      this.nbVars++
    }
  }

  addConstraint = constraint => this.constraints.push(constraint)
  addConstraints = constraints => {
    for ( let i = 0; i < constraints.equations.length; i++ ) {
      this.constraints.push( {equation: constraints.equations[i], constraint: constraints.constraints[i], b: constraints.Bs[i]} )
    }
  }

  countNbVarEcart = () => {
    for (let i = 0; i < this.constraints.length; i++) {
      if (this.constraints[i].constraint != "equal") {
        this.varsEcart.push(this.nbVarEcart + this.nbVars)
        this.nbVarEcart++
      }
    }
  }

  countNbVarArtifical = () => {
    for (let i = 0; i < this.constraints.length; i++) {
      if (this.constraints[i].constraint === "equal") {
        this.varsArtificial.push(this.nbVarArtificials + this.nbVarEcart + this.nbVars)
        this.nbVarArtificials++
      }
      else if (this.constraints[i].constraint === "inf" && this.constraints[i].b < 0 ) {
        this.varsArtificial.push(this.nbVarArtificials + this.nbVarEcart + this.nbVars)
        this.nbVarArtificials++
      }
      else if (this.constraints[i].constraint === "sup" && this.constraints[i].b >= 0 ) {
        this.varsArtificial.push(this.nbVarArtificials + this.nbVarEcart + this.nbVars)
        this.nbVarArtificials++
      }
    }
  }


  compile = optimizationType => {
    if ( optimizationType != "minimize" && optimizationType != "maximize" ) {
      console.warn(`Please pick between \'maximize\' and \'minimize\', not \'${optimizationType}\'`)
      return
    }
    else this.optimizationType = optimizationType

    this.countNbVarEcart()
    this.countNbVarArtifical()
    console.log(this.nbVars)
    console.log(this.nbVarEcart)
    console.log(this.nbVarArtificials)
    console.log("///")
    console.log(this.vars)
    console.log(this.varsEcart)
    console.log(this.varsArtificial)

    let nbEcart = 0
    let nbArtif = 0
    for (let i = 0; i < this.constraints.length; i++) {
      this.tableau[i] = new Float64Array(this.nbVars + this.nbVarEcart + this.nbVarArtificials)
      let sign = this.constraints[i].b < 0 ? -1 : 1
      for (let j = 0; j < this.nbVars; j++) {
        this.tableau[i][j] = sign * this.constraints[i].equation[j] // Ajout variables du problème
      }

      if ( this.constraints[i].constraint === "equal" ) {
        this.tableau[i][nbArtif + this.nbVars + this.nbVarEcart] = 1
        nbArtif++
      }
      if ( this.constraints[i].constraint === "inf" && this.constraints[i].b >= 0 ) {
        this.tableau[i][nbEcart + this.nbVars] = 1
        nbEcart++
      }
      else if ( this.constraints[i].constraint === "inf" && this.constraints[i].b < 0  ) {
        this.tableau[i][nbEcart + this.nbVars] = -1
        nbEcart++
        this.tableau[i][nbArtif + this.nbVars + this.nbVarEcart] = 1
        nbArtif++
      }
      if ( this.constraints[i].constraint === "sup" && this.constraints[i].b >= 0 ) {
        this.tableau[i][nbEcart + this.nbVars] = -1
        nbEcart++
        this.tableau[i][nbArtif + this.nbVars + this.nbVarEcart] = 1
        nbArtif++
      }
      else if ( this.constraints[i].constraint === "sup" && this.constraints[i].b < 0  ) {
        this.tableau[i][nbEcart + this.nbVars] = 1
        nbEcart++
      }
    }
    this.vectorVars = new Float64Array(this.nbVars + this.nbVarEcart + this.nbVarArtificials)
    if ( this.optimizationType === "minimize" ) {
      for ( let i = 0; i < this.nbVars; i++ ) this.vars[i].coeff = -this.vars[i].coeff
      this.infinity = - this.infinity
    }
    for ( let i = 0; i < this.nbVars; i++ )           this.vectorVars[i] = this.vars[i].coeff
    for ( let i = 0; i < this.nbVarArtificials; i++ ) this.vectorVars[this.nbVars + this.nbVarEcart + i] = this.infinity // Remplacer par infinity ?

    this.vectorB = new Float64Array(this.constraints.length)
    for (let i = 0; i < this.constraints.length; i++) {
      // let sign = (this.constraints[i].constraint === "inf" || this.constraints[i].constraint === "equal") ? 1 : - 1
      this.vectorB[i] = Math.abs(this.constraints[i].b) // * sign
    }

    this.vectorBase = new Array(this.constraints.length) // Creation de la solution pour une base réalisable
    nbEcart = 0
    nbArtif = 0
    for (let i = 0; i < this.constraints.length; i++) {
      if ( this.constraints[i].constraint === "equal" ) {
        this.vectorBase[i] = this.varsArtificial[nbArtif]
        nbArtif++
      }
      else if ( this.constraints[i].constraint === "inf" && this.constraints[i].b < 0 ) {
        this.vectorBase[i] = this.varsArtificial[nbArtif]
        nbArtif++
      }
      else if ( this.constraints[i].constraint === "sup" && this.constraints[i].b >= 0 ) {
        this.vectorBase[i] = this.varsArtificial[nbArtif]
        nbArtif++
      }
      else {
        this.vectorBase[i] = this.varsEcart[nbEcart]
        nbEcart++
      }
    }

    // Réécriture de la fonction objective en fonction des variable artificelles :
    let sign = this.optimizationType === "maximize" ? - 1 : 1
    for (let i = 0; i < this.constraints.length; i++ ) {
      console.log(this.vectorBase)
      if ( this.vectorBase[i] >= (this.nbVars + this.nbVarEcart - 1) ) {
        for ( let j = 0; j < this.nbVars + this.nbVarEcart; j++) {
          this.vectorVars[j] += this.tableau[i][j] * this.infinity * sign
        }
      }
    }
    for (let i = 0; i < this.vectorBase.length; i++ ) this.vectorVars[this.vectorBase[i]] = 0
  }


  optimize = () => {
    let nbIteration = 0
    console.log(this.vectorB)
    console.log(this.vectorVars)
    console.log(this.vectorBase)
    console.table(this.tableau)
    while( this.vectorVars[this.argMax(this.vectorVars)] > 0 && nbIteration < this.maxIteration) {
      nbIteration++
      let enteringVarIndex = this.argMax(this.vectorVars)
      let leavingVarIndex = this.leavingVar(enteringVarIndex)

      this.vectorBase[leavingVarIndex] = enteringVarIndex

      let pivot = this.tableau[leavingVarIndex][enteringVarIndex]
      let copyVectorB = [...this.vectorB]
      let copyVectorVars = [...this.vectorVars]
      let copyTableau = this.copyTableau()
      for (let i = 0; i < this.vectorB.length; i++) { // Update vectorB
        if (i === leavingVarIndex) this.vectorB[i] = copyVectorB[i] / pivot
        else this.vectorB[i] = copyVectorB[i] - (this.tableau[i][enteringVarIndex] * copyVectorB[leavingVarIndex]) / pivot
      }
      for (let i = 0; i < this.vectorVars.length; i++) { // Update objective
        this.vectorVars[i] = copyVectorVars[i] - (copyVectorVars[enteringVarIndex] * this.tableau[leavingVarIndex][i]) / pivot
      }

      for (let i = 0; i < this.tableau.length; i++) { // Update tableau
        for (let j = 0; j < this.tableau[i].length; j++) {
          if (i === leavingVarIndex) this.tableau[i][j] = copyTableau[i][j] / pivot
          else this.tableau[i][j] = copyTableau[i][j] - (copyTableau[i][enteringVarIndex] * copyTableau[leavingVarIndex][j]) / pivot
        }
      }
      console.log("///// NEW ITERATION RESULT :")
      console.log("vectorb : ", this.vectorB)
      console.log("vectorVars : ", this.vectorVars)
      console.log("vectorBase : ", this.vectorBase)
      console.table(this.tableau)

      this.computeObjectiveValue()
    }

  }

  computeObjectiveValue = () => {
    let solutionVector = new Float64Array(this.nbVars + this.nbVarEcart)
    for (let i = 0; i < solutionVector.length; i++) {
      let indexVectorB = this.vectorBase.findIndex(x => x === i)
      if (indexVectorB != -1) solutionVector[i] = this.vectorB[indexVectorB]
      else solutionVector[i] = 0
    }
    console.log("Optimum Solution : ", solutionVector)
    let coefficients = new Float64Array(this.nbVars + this.nbVarEcart)
    if ( this.optimizationType === "minimize" ) {
      for (let i = 0; i < this.nbVars; i++) coefficients[i] = - this.vars[i].coeff
    }
    else {
      for (let i = 0; i < this.nbVars; i++) coefficients[i] = this.vars[i].coeff
    }
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
    let tmp = new Float64Array(this.vectorB.length)
    for (let i = 0; i < this.vectorB.length; i++) {
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
      if (vector[i] < valeurMin && vector[i] >= 0) { // TODO: voir eventuellement >= -epsilon pour gérer imprécision float 64
        indexMin = i
        valeurMin = vector[i]
      }
    }
    return indexMin
  }



  copyTableau = () => {
    let arr = []
    for (let i = 0; i < this.tableau.length; i++) {
      arr[i] = new Float64Array(this.tableau[i].length)
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
// m.addVars({
  // coeffs: [1, 2],
// })

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
//   Bs: [21, 18, 5]
// })


// exemple 2
// m.addVar({coeff: 1})
// m.addVar({coeff: -3})
// m.addConstraint({equation: [3, -2], constraint: "inf", b: 7})
// m.addConstraint({equation: [-1, 4], constraint: "inf", b: 9})
// m.addConstraint({equation: [-2, 3], constraint: "inf", b: 6})

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
// m.addVar({coeff: 1.05})
// m.addVar({coeff: 1.05})
// m.addVar({coeff: 1.05})
// m.addVar({coeff: 1.12})
// m.addVar({coeff: 1.12})
// m.addConstraint({equation: [1    ,0    ,0 ,1    ,0], constraint: "inf", b: 1000})
// m.addConstraint({equation: [-1.05,1    ,0 ,0    ,1], constraint: "inf", b: 0})
// m.addConstraint({equation: [0    ,-1.05,1 ,-1.12,0], constraint: "inf", b: 0})

// Exemple 7 EXO 12 A FAIRE BASE CANONIQUE NON REALISABLE
// m.addVar({coeff: 56})
// m.addVar({coeff: 42})
// m.addConstraint({equation: [10,11], constraint: "inf", b: 10700})
// m.addConstraint({equation: [1,1], constraint: "sup", b: 1000})
// m.addConstraint({equation: [1,0], constraint: "inf", b: 700})


// Exemple 1 base canonique non réalisable
// m.addVars({
//   coeffs: [1, 2, 3]
// })
//
// m.addConstraints({
//   equations: [
//     [1, 1, 0],
//     [2, 2, -1],
//     [12, 8, -5]
//   ],
//   constraints: ["inf", "equal", "equal"],
//   Bs: [5, 6, 32]
// })

// Exemple 2 base canonique non réalisable
// m.addVars({
//   coeffs: [3, 10]
// })
//
// m.addConstraints({
//   equations: [
//     [5, 6],
//     [2, 7]
//   ],
//   constraints: ["sup", "sup"],
//   Bs: [10, 14]
// })


m.addVars({
  coeffs: [1, 2]
})

m.addConstraints({
  equations: [
    [1, 1],
    [3, -2],
    [-1, 4]
  ],
  constraints: ["inf", "sup", "sup"],
  Bs: [12, 6, 8]
})

// A VERIFIER
// m.addVars({
//   coeffs: [1, 1]
// })
//
// m.addConstraints({
//   equations: [
//     [1, 1],
//     [1, 0]
//   ],
//   constraints: ["inf", "equal"],
//   Bs: [5, -1]
// })

/////////////////////////////////////////
m.compile("maximize")
// m.compile("minimize")
m.optimize()
console.log(m)
