'use strict';

// Symetric tsp : http://www-desir.lip6.fr/~fouilhoux/documents/OptComb.pdf page 30

// TODO: voir cyclage et dégénérescence
// TODO: utiliser des noms pour les solutions, même string '1' pour avoir un dictionnaire facile à utiliser
// TODO: tester infinity au lieu de 100 000

// TODO: voir s'il faut ajouter les contraintes Xi > 0
// TODO: passer en module la librairie
// TODO: rename les i, j dégeu
// TODO: utiliser arr.map au lieu des for dégeu ?
// TODO: A VERIFIER VARIABLE NEGATIVE + EQUAL
// TODO: copyTableau() en ES7 [..., ...]
class Model {
  constructor() {
    this.vars = []
    this.varsEcart = [] // TODO: passer en Float64Array ?
    this.varsArtificial = []
    this.constraints = [] // TODO: ne plus utilise constraints.length, voir quelle variable virer, opti tableau ?
    this.nbVars = 0
    this.nbVarEcart = 0
    this.nbVarArtificials = 0
    this.nbGMIcuts = 0
    this.optimizationType = undefined

    this.tableau = []
    this.vectorVars = undefined
    this.vectorB = undefined
    this.vectorBase = undefined
    this.solutionVector = undefined

    this.maxIteration = 50
    this.infinity = -10000000000
  }

  addVar = variable => {
    this.vars.push({
      id: this.nbVars, // voir utilite
      name: variable.name || undefined,
      coeff: variable.coeff || 0,
      type: variable.type
    })
    this.nbVars++
  }
  addVars = variables => {
    for (let i = 0; i < variables.coeffs.length; i++) {
      this.vars.push({
        id: this.nbVars, // voir utilite
        name: variables.names === undefined ? undefined : variables.names[i],
        coeff: variables.coeffs[i] || 0,
        type: variables.types[i] === undefined ? console.warn(`Missing variable type, ${variables.coeffs.length} variables given but only ${variables.types.length} type specified`) : variables.types[i]
      })
      this.nbVars++
    }
  }

  addConstraint = constraint => this.constraints.push(constraint)
  addConstraints = constraints => {
    for (let i = 0; i < constraints.equations.length; i++){
      this.constraints.push({equation: constraints.equations[i], constraint: constraints.constraints[i], b: constraints.Bs[i]})
    }
  }

  countNbVarEcart = () => {
    for (let i = 0; i < this.constraints.length; i++) {
      if (this.constraints[i].constraint !== 'equal') {
        this.varsEcart.push(this.nbVarEcart + this.nbVars)
        this.nbVarEcart++
      }
    }
  }

  countNbVarArtifical = () => {
    for (let i = 0; i < this.constraints.length; i++) {
      if (this.constraints[i].constraint === 'equal') {
        this.varsArtificial.push(this.nbVarArtificials + this.nbVarEcart + this.nbVars)
        this.nbVarArtificials++
      }
      else if (this.constraints[i].constraint === 'inf' && this.constraints[i].b < 0) {
        this.varsArtificial.push(this.nbVarArtificials + this.nbVarEcart + this.nbVars)
        this.nbVarArtificials++
      }
      else if (this.constraints[i].constraint === 'sup' && this.constraints[i].b >= 0) {
        this.varsArtificial.push(this.nbVarArtificials + this.nbVarEcart + this.nbVars)
        this.nbVarArtificials++
      }
    }
  }


  compile = optimizationType => {
    if (optimizationType !== 'minimize' && optimizationType !== 'maximize') {
      console.warn(`Please pick between \'maximize\' and \'minimize\', not \'${optimizationType}\'`)
      return
    } else this.optimizationType = optimizationType

    this.countNbVarEcart()
    this.countNbVarArtifical()


    let nbEcart = 0
    let nbArtif = 0
    for (let i = 0; i < this.constraints.length; i++) {
      // this.tableau[i] = new Float64Array(this.nbVars + this.nbVarEcart + this.nbVarArtificials)
      this.tableau[i] = new Array(this.nbVars + this.nbVarEcart + this.nbVarArtificials).fill(0)
      let sign = this.constraints[i].b < 0 ? -1 : 1
      for (let j = 0; j < this.nbVars; j++) {
        this.tableau[i][j] = sign * this.constraints[i].equation[j] // Ajout variables du problème
      }

      if (this.constraints[i].constraint === 'equal') {
        this.tableau[i][nbArtif + this.nbVars + this.nbVarEcart] = 1
        nbArtif++
      }
      if (this.constraints[i].constraint === 'inf' && this.constraints[i].b >= 0) {
        this.tableau[i][nbEcart + this.nbVars] = 1
        nbEcart++
      }
      else if (this.constraints[i].constraint === 'inf' && this.constraints[i].b < 0) {
        this.tableau[i][nbEcart + this.nbVars] = -1
        nbEcart++
        this.tableau[i][nbArtif + this.nbVars + this.nbVarEcart] = 1
        nbArtif++
      }
      if (this.constraints[i].constraint === 'sup' && this.constraints[i].b >= 0) {
        this.tableau[i][nbEcart + this.nbVars] = -1
        nbEcart++
        this.tableau[i][nbArtif + this.nbVars + this.nbVarEcart] = 1
        nbArtif++
      }
      else if (this.constraints[i].constraint === 'sup' && this.constraints[i].b < 0) {
        this.tableau[i][nbEcart + this.nbVars] = 1
        nbEcart++
      }
    }
    this.vectorVars = new Array(this.nbVars + this.nbVarEcart + this.nbVarArtificials).fill(0)
    if (this.optimizationType === 'minimize') {
      for (let i = 0; i < this.nbVars; i++) this.vars[i].coeff = - this.vars[i].coeff
      this.infinity = - this.infinity
    }

    for (let i = 0; i < this.nbVars; i++)           this.vectorVars[i] = this.vars[i].coeff

    // TODO: inutile ? cf https://www.iutbayonne.univ-pau.fr/~grau/2A/RO/chapitre4.html
    // for (let i = 0; i < this.nbVarArtificials; i++) this.vectorVars[this.nbVars + this.nbVarEcart + i] = this.infinity // Remplacer par infinity ?

    this.vectorB = new Array(this.constraints.length)
    for (let i = 0; i < this.constraints.length; i++) {
      // let sign = (this.constraints[i].constraint === 'inf' || this.constraints[i].constraint === 'equal') ? 1 : - 1
      this.vectorB[i] = Math.abs(this.constraints[i].b) // * sign
    }

    this.vectorBase = new Array(this.constraints.length) // Creation de la solution pour une base réalisable
    nbEcart = 0
    nbArtif = 0
    for (let i = 0; i < this.constraints.length; i++) {
      if (this.constraints[i].constraint === 'equal') {
        this.vectorBase[i] = this.varsArtificial[nbArtif]
        nbArtif++
      }
      else if (this.constraints[i].constraint === 'inf' && this.constraints[i].b < 0) {
        this.vectorBase[i] = this.varsArtificial[nbArtif]
        nbArtif++
      }
      else if (this.constraints[i].constraint === 'sup' && this.constraints[i].b >= 0) {
        this.vectorBase[i] = this.varsArtificial[nbArtif]
        nbArtif++
      }
      else {
        this.vectorBase[i] = this.varsEcart[nbEcart]
        nbEcart++
      }
    }

    // Réécriture de la fonction objective en fonction des variable artificelles :
    let sign = this.optimizationType === 'maximize' ? - 1 : 1
    for (let i = 0; i < this.constraints.length; i++) {
      if (this.vectorBase[i] >= (this.nbVars + this.nbVarEcart)) {
        for (let j = 0; j < this.nbVars + this.nbVarEcart; j++) {
          this.vectorVars[j] += this.tableau[i][j] * this.infinity * sign
        }
      }
    }
    for (let i = 0; i < this.vectorBase.length; i++) this.vectorVars[this.vectorBase[i]] = 0
  }


  optimize = () => {
    let nbIteration = 0
    console.log('STARTING OPTIMIZING')
    console.log('nbVars : ', this.nbVars)
    console.log('nbEcarts : ', this.nbVarEcart)
    console.log('nbArtifs : ', this.nbVarArtificials)
    console.log('vectorB : ', this.vectorB)
    console.log('vectorVars : ', this.vectorVars)
    console.log('vectorBase : ', this.vectorBase)
    console.table(this.tableau)
    while (this.vectorVars[this.argMax(this.vectorVars)] > 0 && nbIteration < this.maxIteration) {
      nbIteration++
      let enteringVarIndex = this.argMax(this.vectorVars)
      let leavingVarIndex = this.leavingVar(enteringVarIndex)
      console.log('entering : ', enteringVarIndex)
      console.log('leaving : ', leavingVarIndex)
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
      console.log('///// NEW ITERATION RESULT :')
      console.log('vectorb : ', this.vectorB)
      console.log('vectorVars : ', this.vectorVars)
      console.log('vectorBase : ', this.vectorBase)
      console.table(this.tableau)

      this.computeObjectiveValue()
    }


    //////////////////////////////
    // Gomory mixed integer cuts :
    //////////////////////////////

    // faire une fonction check integer et un while dessus
    // let row = checkinterger, if a !== -1, refaire a la fin du while
    let rowNotInteger = this.checkInterger()
    let nbIterations = 0
    while (rowNotInteger !== -1 && nbIterations < 200) { // TODO: mettre une variable
      nbIterations++
      console.log(nbIterations)
      let fractionalX = this.vectorB[rowNotInteger] - Math.floor(this.vectorB[rowNotInteger])
      console.log("NEW CUT")
      this.nbGMIcuts++
      this.vectorBase.push(this.nbVars + this.nbVarEcart + this.nbVarArtificials + this.nbGMIcuts)
      this.vectorB.push(-fractionalX)
      this.vectorVars.push(0)

      // Ajout dernière colonne au tableau :
      this.tableau.map(row => row.push(0))
      // Ajout dernière ligne au tableau :
      this.tableau.push(new Array(this.nbVars + this.nbVarEcart + this.nbVarArtificials + this.nbGMIcuts).fill(0))
      // La derniere colonne de la ligne ajoutée est hors base :
      this.tableau[this.tableau.length - 1][this.tableau[0].length - 1] = 1
      // Calcul du tableau de la ligne ajoutée selon GMI cut
      for (let i = 0; i < this.tableau[0].length - 1; i++) {
        // let fractionalXi = this.tableau[rowNotInteger][i] - Math.floor(this.tableau[rowNotInteger][i])
        let fractionalXi = this.tableau[rowNotInteger][i] >= 0 ?
        this.tableau[rowNotInteger][i] - Math.floor(this.tableau[rowNotInteger][i]) :
        - this.tableau[rowNotInteger][i] - Math.floor(-this.tableau[rowNotInteger][i])
        // if (fractionalXi <= fractionalX) {
        if ( fractionalXi === 0) {
          this.tableau[this.tableau.length - 1][i] = 0
        }
        else if (this.tableau[rowNotInteger][i] >= 0) {
          this.tableau[this.tableau.length - 1][i] = - fractionalXi

        } else {
          // TODO: check car rentre pas dedans et on se retrouve avec -0.5 au lieu de -1.5
          this.tableau[this.tableau.length - 1][i] = - (fractionalX / (fractionalX - 1)) * this.tableau[rowNotInteger][i]
          // todo fractionalXi === 0 ? 0 : a rajouter peut être juste au dessus
        }
      }

      // console.log('vectorb : ', this.vectorB)
      // console.log('vectorVars : ', this.vectorVars)
      // console.log('vectorBase : ', this.vectorBase)
      // console.table(this.tableau)
      this.dualSimplex() // // TODO: faire dual simplex meme en dehors de integer
      rowNotInteger = this.checkInterger()
    }


    console.log('vectorb : ', this.vectorB)
    console.log('vectorVars : ', this.vectorVars)
    console.log('vectorBase : ', this.vectorBase)
    // console.table(this.tableau)

    this.computeObjectiveValue()

  }
// TODO: a arrondir les trucs pénible en cours de route
// pour les variables donnees au début, virer chiffres après virgule en faisant x10.. /10
  checkInterger = () => {
    for (let i = 0; i < this.vars.length; i++) {
      // Pour chaque variable, si elle est de type integer, on regarde si la valeur trouvée est bien entière
      let rowNotInteger = this.vectorBase.findIndex( x => x === i)
      if (rowNotInteger !== -1) {
        let fractionalX = this.vectorB[rowNotInteger] - Math.floor(this.vectorB[rowNotInteger])
        if (fractionalX !== 0 && this.vars[i].type === 'int') {
          return rowNotInteger
        }
      }
    }
    return -1
  }

  dualSimplex = () => {
    while (this.vectorB[this.argMinDual(this.vectorB)] < 0) { // TODO: add max iteration ?
      // console.log(this.vectorB[this.argMinDual(this.vectorB)])
      let leavingVarIndex = this.argMinDual(this.vectorB)
      let enteringVarIndex = this.leavingVarDual(leavingVarIndex)
      // console.log(leavingVarIndex)

      this.vectorBase[leavingVarIndex] = enteringVarIndex // inversé exprès pour dual

      let pivot = this.tableau[leavingVarIndex][enteringVarIndex]
      // console.log(pivot)
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
      // console.log('///// NEW ITERATION DUAL RESULT :')
      // console.log('vectorb : ', this.vectorB)
      // console.log('vectorVars : ', this.vectorVars)
      // console.log('vectorBase : ', this.vectorBase)
      // console.table(this.tableau)

      this.computeObjectiveValue()
    }
  }

  computeObjectiveValue = () => {
    // let solutionVector = new Float64Array(this.nbVars + this.nbVarEcart)
    // for (let i = 0; i < solutionVector.length; i++) {
    //   let indexVectorB = this.vectorBase.findIndex( x => x === i)
    //   if (indexVectorB !== -1) solutionVector[i] = this.vectorB[indexVectorB]
    //   else solutionVector[i] = 0
    // }
    let solutionVector = new Float64Array(this.nbVars)
    for (let i = 0; i < solutionVector.length; i++) {
      let indexVectorB = this.vectorBase.findIndex( x => x === i)
      solutionVector[i] = this.vectorB[indexVectorB] || 0
    }
    console.log('Optimum Solution : ', solutionVector)
    // let coefficients = new Float64Array(this.nbVars + this.nbVarEcart)
    let coefficients = new Float64Array(this.nbVars)
    if (this.optimizationType === 'minimize') {
      for (let i = 0; i < this.nbVars; i++) coefficients[i] = - this.vars[i].coeff
    }
    else {
      for (let i = 0; i < this.nbVars; i++) coefficients[i] = this.vars[i].coeff
    }
    this.solutionVector = solutionVector
    let optimum = this.dot(solutionVector, coefficients)
    console.log('Optimum value of Objective function : ', optimum)
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
    console.log(tmp)
    let index = this.argMin(tmp)
    console.log(index)
    return index
  }

  leavingVarDual = enteringVarIndex => {
    let tmp = new Float64Array(this.vectorVars.length)
    for (let i = 0; i < this.vectorVars.length; i++) {
      if (this.tableau[enteringVarIndex][i] >= 0) tmp[i] = 1000000000000 // division par 0 ne nous intéresse pas
      else tmp[i] = this.vectorVars[i] / this.tableau[enteringVarIndex][i]
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
    let valeurMin = 1000000000000 // TODO: Voir si 0 ou + infini à utiliser
    for (let i = 0; i < vector.length; i++) {
      if (vector[i] < valeurMin && vector[i] >= 0) { // TODO: voir eventuellement >= -epsilon pour gérer imprécision float 64
        indexMin = i
        valeurMin = vector[i]
      }
    }
    return indexMin
  }
  argMinDual = vector => {
    let indexMin = 0
    let valeurMin = 1000000000000 // TODO: Voir si 0 ou + infini à utiliser
    for (let i = 0; i < vector.length; i++) {
      if (vector[i] < valeurMin) { // TODO: voir eventuellement >= -epsilon pour gérer imprécision float 64
        indexMin = i
        valeurMin = vector[i]
      }
    }
    return indexMin
  }

  copyTableau = () => {
    let arr = []
    for (let i = 0; i < this.tableau.length; i++ ) {
      arr[i] = new Float64Array( this.tableau[i].length)
      for (let j = 0; j < this.tableau[i].length; j++) {
        arr[i][j] = this.tableau[i][j]
      }
    }
    return arr
  }
}



let m = new Model()
m.addVars({
  coeffs: [-3, 1, 3],
  types: ['real', 'real', 'int']
})

m.addConstraints({
  equations: [
    [-1, 2, 1],
    [0 ,2, -1.5],
    [1, -3, 2]
  ],
  constraints: ['inf', 'inf', 'inf'],
  Bs: [4, 1, 3]
})

// m.addVars({
//   coeffs: [-2, -1],
//   types: ['real', 'real']
// })
//
// m.addConstraints({
//   equations: [
//     [-3, -1],
//     [-4, -3],
//     [-1, -2]
//   ],
//   constraints: ['inf', 'inf', 'inf'],
//   Bs: [-3, -6, -3]
// })
// m.addVars({
//   coeffs: [5, 3],
//   types: ['real', 'real']
// })
//
// m.addConstraints({
//   equations: [
//     [2, 4],
//     [2, 2],
//     [5, 2]
//   ],
//   constraints: ['inf', 'equal', 'sup'],
//   Bs: [12, 10, 10]
// })


m.compile('maximize')
// m.compile('minimize')
m.optimize()
console.log(m)
