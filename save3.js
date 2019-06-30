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
    this.infinity = -10000000
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
    }
    else this.optimizationType = optimizationType

    this.countNbVarEcart()
    this.countNbVarArtifical()
    console.log(this.nbVars)
    console.log(this.nbVarEcart)
    console.log(this.nbVarArtificials)
    console.log('///')
    console.log(this.vars)
    console.log(this.varsEcart)
    console.log(this.varsArtificial)

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
    for (let i = 0; i < this.nbVarArtificials; i++) this.vectorVars[this.nbVars + this.nbVarEcart + i] = this.infinity // Remplacer par infinity ?

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
    console.log( this.vectorVars )

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
    // console.log( this.vectorB )
    // console.log( this.vectorVars )
    // console.log( this.vectorBase )
    // console.table( this.tableau )
    while (this.vectorVars[this.argMax(this.vectorVars)] > 0 && nbIteration < this.maxIteration) {
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
      // console.log('///// NEW ITERATION RESULT :')
      // console.log('vectorb : ', this.vectorB)
      // console.log('vectorVars : ', this.vectorVars)
      // console.log('vectorBase : ', this.vectorBase)
      // console.table(this.tableau)

      // this.computeObjectiveValue()
    }
    console.log('FIN RELAXATION')
    this.computeObjectiveValue()

    //////////////////////////////
    // Gomory mixed integer cuts :
    //////////////////////////////

    // faire une fonction check integer et un while dessus
    // let row = checkinterger, if a !== -1, refaire a la fin du while
    let rowNotInteger = this.checkInterger()
    let nbIterations = 0
    while (rowNotInteger !== -1 && nbIterations < 2000) {
      nbIterations++
      console.log(nbIterations)
      // for (let i = 0; i < this.vars.length; i++) {
          // Pour chaque variable, si elle est entière on regarde si la valeur trouvée est bien entière
        let fractionalX = this.vectorB[rowNotInteger] - Math.floor(this.vectorB[rowNotInteger])
        // if (fractionalX !== 0 && this.vars[i].type === 'int') {
          console.log("new cut")
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
        // }
      // }
      // console.log('vectorb : ', this.vectorB)
      // console.log('vectorVars : ', this.vectorVars)
      // console.log('vectorBase : ', this.vectorBase)
      // console.table(this.tableau)
      this.dualSimplex()
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
      console.log(this.vars.length)
      console.log(i)
      console.log(this.vectorB)
      console.log(this.vectorBase)
        // Pour chaque variable, si elle est entière on regarde si la valeur trouvée est bien entière
      let rowNotInteger = this.vectorBase.findIndex( x => x === i)
      console.log(rowNotInteger)
      if (rowNotInteger !== -1) {
        let fractionalX = this.vectorB[rowNotInteger] - Math.floor(this.vectorB[rowNotInteger])
        console.log(fractionalX)
        let espilon = 0.000001
        // && Math.abs(fractionalX) < espilon
        if (fractionalX !== 0 && this.vars[i].type === 'int' && Math.abs(fractionalX) >= espilon) {
          console.log('OUIIIIIIIIIIIIIIIIIII')
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
    // console.log(tmp)
    let index = this.argMin(tmp)
    return index
  }

  leavingVarDual = enteringVarIndex => {
    let tmp = new Float64Array(this.vectorVars.length)
    for (let i = 0; i < this.vectorVars.length; i++) {
      if (this.tableau[enteringVarIndex][i] >= 0) tmp[i] = 100000000 // division par 0 ne nous intéresse pas
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
    let valeurMin = 100000000 // TODO: Voir si 0 ou + infini à utiliser
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
    let valeurMin = 100000000 // TODO: Voir si 0 ou + infini à utiliser
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

// exemple 1
// m.addVar({coeff: 1})
// m.addVar({coeff: 2})
// m.addVars({
  // coeffs: [1, 2],
// })

// m.addConstraint({equation: [1, 3], constraint: 'inf', b: 21})
// m.addConstraint({equation: [-1, 3], constraint: 'inf', b: 18})
// m.addConstraint({equation: [1, -1], constraint: 'inf', b: 5})
// m.addConstraints({
//   equations: [
//     [1, 3],
//     [-1, 3],
//     [1, -1]
//   ],
//   constraints: ['inf', 'inf', 'inf'],
//   Bs: [21, 18, 5]
// })


// exemple 2
// m.addVar({coeff: 1})
// m.addVar({coeff: -3})
// m.addConstraint({equation: [3, -2], constraint: 'inf', b: 7})
// m.addConstraint({equation: [-1, 4], constraint: 'inf', b: 9})
// m.addConstraint({equation: [-2, 3], constraint: 'inf', b: 6})

// Exemple 4
// m.addVar({coeff: 1})
// m.addVar({coeff: 2})
// m.addConstraint({equation: [1, 1], constraint: 'inf', b: 12})
// m.addConstraint({equation: [3, -1], constraint: 'sup', b: 6})
// m.addConstraint({equation: [-1, 4], constraint: 'sup', b: 8})
// m.addConstraint({equation: [0, 1], constraint: 'inf', b: 6})

// Exemple 5 non borné
// m.addVar({coeff: 1})
// m.addVar({coeff: 2})
// m.addConstraint({equation: [3, -2], constraint: 'sup', b: 6})
// m.addConstraint({equation: [-1, 4], constraint: 'sup', b: 8})

// Exemple 6 placements
// for ( let i = 0; i < 7 ; i++ ) m.addVar({coeff: 1.05})
// for ( let i = 0; i < 6 ; i++ ) m.addVar({coeff: 1.12})
// for ( let i = 0; i < 5 ; i++ ) m.addVar({coeff: 1.19})
//
// //1
// m.addConstraint({equation: [1,0,0,0,0,0,0, 1,0,0,0,0,0, 1,0,0,0,0], constraint: 'inf', b: 1000})
// // m.addConstraint({equation: [1,0,0,0,0,0,0, 1,0,0,0,0,0, 1,0,0,0,0], constraint: 'sup', b: 1000})
// //2
// m.addConstraint({equation: [-1,1,0,0,0,0,0, -1,1,0,0,0,0, -1,1,0,0,0], constraint: 'inf', b: 0})
// // m.addConstraint({equation: [1,-1,0,0,0,0,0, 1,-1,0,0,0,0, 1,-1,0,0,0], constraint: 'sup', b: 0})
// //3
// m.addConstraint({equation: [0,-1,1,0,0,0,0, 0,-1,1,0,0,0, 0,-1,1,0,0], constraint: 'inf', b: 0})
// // m.addConstraint({equation: [0,1,-1,0,0,0,0, 0,1,-1,0,0,0, 0,1,-1,0,0], constraint: 'sup', b: 0})
// //4
// m.addConstraint({equation: [0,0,-1,1,0,0,0, 0,0,-1,1,0,0, 0,0,-1,1,0], constraint: 'inf', b: 0})
// // m.addConstraint({equation: [0,0,1,-1,0,0,0, 0,0,1,-1,0,0, 0,0,1,-1,0], constraint: 'sup', b: 0})
// //5
// m.addConstraint({equation: [0,0,0,-1,1,0,0, 0,0,0,-1,1,0, 0,0,0,-1,1], constraint: 'inf', b: 0})
// // m.addConstraint({equation: [0,0,0,1,-1,0,0, 0,0,0,1,-1,0, 0,0,0,1,-1], constraint: 'sup', b: 0})
// //6
// m.addConstraint({equation: [0,0,0,0,-1,1,0, 0,0,0,0,-1,1, 0,0,0,0,-1], constraint: 'inf', b: 0})
// // m.addConstraint({equation: [0,0,0,0,1,-1,0, 0,0,0,0,1,-1, 0,0,0,0,1], constraint: 'sup', b: 0})
// //7
// m.addConstraint({equation: [0,0,0,0,0,-1,1, 0,0,0,0,0,-1, 0,0,0,0,0], constraint: 'inf', b: 0})
// // m.addConstraint({equation: [0,0,0,0,0,1,-1, 0,0,0,0,0,1, 0,0,0,0,0], constraint: 'sup', b: 0})
// m.addVar({coeff: 1.05})
// m.addVar({coeff: 1.05})
// m.addVar({coeff: 1.05})
// m.addVar({coeff: 1.12})
// m.addVar({coeff: 1.12})
// m.addConstraint({equation: [1    ,0    ,0 ,1    ,0], constraint: 'inf', b: 1000})
// m.addConstraint({equation: [-1.05,1    ,0 ,0    ,1], constraint: 'inf', b: 0})
// m.addConstraint({equation: [0    ,-1.05,1 ,-1.12,0], constraint: 'inf', b: 0})

// Exemple 7 EXO 12 A FAIRE BASE CANONIQUE NON REALISABLE
// m.addVar({coeff: 56})
// m.addVar({coeff: 42})
// m.addConstraint({equation: [10,11], constraint: 'inf', b: 10700})
// m.addConstraint({equation: [1,1], constraint: 'sup', b: 1000})
// m.addConstraint({equation: [1,0], constraint: 'inf', b: 700})


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
//   constraints: ['inf', 'equal', 'equal'],
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
//   constraints: ['sup', 'sup'],
//   Bs: [10, 14]
// })

// m.addVars({
//   coeffs: [-2, -3, -4]
// })
//
// m.addConstraints({
//   equations: [
//     [3, 2, 1],
//     [2, 5, 3]
//   ],
//   constraints: ['equal', 'equal'],
//   Bs: [10, 15]
// })


// TODO:  A VERIFIER VARIABLE NEGATIVE + EQUAL
// m.addVars({
//   coeffs: [1, 1]
// })
//
// m.addConstraints({
//   equations: [
//     [1, 1],
//     [1, 0]
//   ],
//   constraints: ['inf', 'equal'],
//   Bs: [5, -1]
// })


// INTEGERS

// m.addVars({
//   coeffs: [1, 2]
// })
//
// m.addConstraints({
//   equations: [
//     [0, 2],
//     [1, 1],
//     [2, 0]
//   ],
//   constraints: ['inf', 'inf', 'inf'],
//   Bs: [7, 7, 11]
// })

// m.addVars({
//   coeffs: [3, 4]
// })
//
// m.addConstraints({
//   equations: [
//     [3, -1],
//     [3, 11]
//   ],
//   constraints: ['inf', 'inf'],
//   Bs: [12, 66]
// })


// m.addVars({
//   coeffs: [2, 1],
//   types: ['int', 'int']
// })
//
// m.addConstraints({
//   equations: [
//     [1, 1],
//     [-1, 1],
//     [6, 2]
//   ],
//   constraints: ['inf', 'inf', 'inf'],
//   Bs: [5, 0, 21]
// })


// m.addVars({
//   coeffs: [2, 1],
//   types: ['int', 'int']
// })
//
// m.addConstraints({
//   equations: [
//     [1, 1],
//     [-1, 1],
//     [6, 2]
//   ],
//   constraints: ['inf', 'inf', 'inf'],
//   Bs: [2.9, 0, 21] // A TESTER : NOMBRE A VIRGULE
// })


// m.addVars({
//   coeffs: [4, 5],
//   types: ['int', 'int']
// })
//
// m.addConstraints({
//   equations: [
//     [1, 4],
//     [3, 2]
//   ],
//   constraints: ['sup', 'sup'],
//   Bs: [5, 7]
// })

// m.addVars({
//   coeffs: [5, 6],
//   types: ['int', 'real']
// })
//
// m.addConstraints({
//   equations: [
//     [10, 3],
//     [2, 3]
//   ],
//   constraints: ['inf', 'inf'],
//   Bs: [52, 18]
// })

/////////////////////////////////////////
// m.compile('maximize')
// // m.compile('minimize')
// m.optimize()
// console.log(m)

////////////////////////
// TSP
////////////////////////

class TSP {
  constructor(nbCities) {
    this.nbCities = nbCities
    this.width = 1000
    this.height = 1000
    // this.cities = [
    //   {x: 1, y: 1},
    //   {x: 2, y: 2},
    //   {x: 3, y: 3},
    //   {x: 4, y: 4},
    //   {x: 5, y: 5},
    // ]
    this.cities = this.createCities()
    this.matrixDistances = this.computeMatrixDistances()
  }
  createCities = () => new Array(this.nbCities).fill(0).map(x => ({x: Math.floor(Math.random() * this.width) + 1, y: Math.floor(Math.random() * this.height) + 1}))
  computeMatrixDistances = () => { // TODO: round les distances même si perte de précision pour que ce soit mieux pour le pl ?
    let matrix = new Array(this.nbCities).fill(new Float64Array(this.nbCities))
    matrix = matrix.map( (row, index) => {
      return row.map( (col, index2) => this.distance(this.cities[index].x, this.cities[index2].x, this.cities[index].y, this.cities[index2].y))
    })
    return matrix
  }
  distance = (x1, x2, y1, y2) => Math.sqrt( (x1-x2)*(x1-x2) + (y1-y2)*(y1-y2) )
}



///////////////////////////

let ctx, canvas
let width, height
const init = () => {
  canvas = document.getElementById('canvas')
  ctx = canvas.getContext('2d')
  ctx.canvas.width = 1050
  ctx.canvas.height = 1050
  width = 1050
  height = 1050
  ////////////////////////////////////
  // VERSION SANS DIAGONALE
  // let nbCities = 5
  // let tsp = new TSP(nbCities)
  //
  // let vars = new Array()
  // for (let i = 0; i < nbCities; i++) {
  //   for (let j = 0; j < nbCities; j++) {
  //     if (i !== j) vars.push(tsp.matrixDistances[i][j])
  //   }
  // }
  //
  // let constraintsEquations = new Array(nbCities)
  // for (let i = 0; i < nbCities; i++) { // Une contrainte pour chaque ville / ligne de la matrice
  //   let constraint = new Array(nbCities * (nbCities-1)).fill(0)
  //   for (let a = i*(nbCities-1); a < (i+1)*(nbCities-1); a++) {
  //     constraint[a] = 1
  //   }
  //   constraintsEquations[i] = constraint
  // }
  // for (let i = 0; i < nbCities * (nbCities-1); i++) {
  //   let constraint = new Array(nbCities * (nbCities-1)).fill(0)
  //   constraint[i] = 1
  //   constraintsEquations.push(constraint)
  // }
  //
  // m.addVars({
  //   coeffs: vars,
  //   types: new Array(nbCities * (nbCities-1)).fill('int')
  // })
  //
  // m.addConstraints({
  //   equations: constraintsEquations,
  //   constraints: [...new Array(nbCities).fill('equal'), ...new Array(nbCities * (nbCities-1)).fill('inf')],
  //   Bs: [...new Array(nbCities).fill(2), ...new Array(nbCities * (nbCities-1)).fill(1)]
  // })
  //
  // m.compile('minimize')
  // m.optimize()
  //
  // let result = m.solutionVector
  // let resultReshaped = new Array(nbCities)
  // for (let i = 0; i < nbCities; i++) resultReshaped[i] = []
  // for (let i = 0; i < result.length; i++) {
  //   resultReshaped[Math.floor(i/(nbCities-1))].push(result[i])
  // }
  // for (let i = 0; i < nbCities; i++) {
  //   resultReshaped[i].splice(i, 0, 0)
  // }
  // console.log(result)
  // console.log(resultReshaped)
  // loop()

  // // VERSION DIAGONALE PENALISEE
  let nbCities = 10
  let tsp = new TSP(nbCities)

  let vars = new Array()
  for (let i = 0; i < nbCities; i++) {
    for (let j = 0; j < nbCities; j++) {
      if (i !== j) vars.push(tsp.matrixDistances[i][j])
      else vars.push(100000000)
    }
  }
  // Symétrique tsp
  let constraintsEquations = new Array(nbCities)
  for (let i = 0; i < nbCities; i++) { // Une contrainte pour chaque ville / ligne de la matrice
    let constraint = new Array(nbCities * nbCities).fill(0)
    // Somme à 1 en ligne
    for (let a = i*nbCities; a < (i+1)*nbCities; a++) constraint[a] = 1
    // Somme à 1 en colonne
    for (let a = 0; a < nbCities; a++) constraint[a*nbCities + i] = 1

    constraintsEquations[i] = constraint
  }

  // Contraintes var inférieur à 1
  for (let i = 0; i < nbCities * nbCities; i++) {
    let constraint = new Array(nbCities * nbCities + nbCities).fill(0)
    constraint[i] = 1
    constraintsEquations.push(constraint)
  }


  m.addVars({
    coeffs: vars,
    types: [...new Array(nbCities * nbCities).fill('int')]
  })

  m.addConstraints({
    equations: constraintsEquations, // TODO: voir si inf à 1 toujours utile par la suite ?
    constraints: [...new Array(nbCities).fill('equal'), ...new Array(nbCities * nbCities).fill('inf')],
    Bs:          [...new Array(nbCities).fill(2)      , ...new Array(nbCities * nbCities).fill(1)    ]
  })

  m.compile('minimize')
  m.optimize()

  let result = m.solutionVector
  console.log(result)
  let resultReshaped = new Array(nbCities)
  for (let i = 0; i < nbCities; i++) resultReshaped[i] = []
  for (let i = 0; i < nbCities; i++) {
    resultReshaped[Math.floor(i/nbCities)].push(result[i])
  }
  console.log(vars)
  console.log(constraintsEquations)
  console.log(result)
  console.log(resultReshaped)
  // loop()
  draw(tsp, resultReshaped, nbCities)
}

// const loop = () => {
//   requestAnimationFrame(loop)
// }

const draw = (tsp, result, nbCities) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "#000000"

  for (let i = 0; i < tsp.cities.length; i++) { // Dessine les points
    ctx.beginPath()
    ctx.arc(tsp.cities[i].x + 50, tsp.cities[i].y + 50, 5, 0, 2*Math.PI)
    ctx.fill()
  }

  for (let i = 0; i < nbCities; i++) {
    for (let j = 0; j < nbCities; j++) {
      if (result[i][j] === 1) {
        ctx.beginPath()
        ctx.moveTo(tsp.cities[i].x + 50, tsp.cities[i].y + 50) // Dessine le chemin entre les points
        ctx.lineTo(tsp.cities[j].x + 50, tsp.cities[j].y + 50)
        ctx.stroke()
      }
    }

  }
}

window.addEventListener('load', init)























//
// ////////////////////////////////////
// // VERSION SANS DIAGONALE
// // let nbCities = 5
// // let tsp = new TSP(nbCities)
// //
// // let vars = new Array()
// // for (let i = 0; i < nbCities; i++) {
// //   for (let j = 0; j < nbCities; j++) {
// //     if (i !== j) vars.push(tsp.matrixDistances[i][j])
// //   }
// // }
// //
// // let constraintsEquations = new Array(nbCities)
// // for (let i = 0; i < nbCities; i++) { // Une contrainte pour chaque ville / ligne de la matrice
// //   let constraint = new Array(nbCities * (nbCities-1)).fill(0)
// //   for (let a = i*(nbCities-1); a < (i+1)*(nbCities-1); a++) {
// //     constraint[a] = 1
// //   }
// //   constraintsEquations[i] = constraint
// // }
// // for (let i = 0; i < nbCities * (nbCities-1); i++) {
// //   let constraint = new Array(nbCities * (nbCities-1)).fill(0)
// //   constraint[i] = 1
// //   constraintsEquations.push(constraint)
// // }
// //
// // m.addVars({
// //   coeffs: vars,
// //   types: new Array(nbCities * (nbCities-1)).fill('int')
// // })
// //
// // m.addConstraints({
// //   equations: constraintsEquations,
// //   constraints: [...new Array(nbCities).fill('equal'), ...new Array(nbCities * (nbCities-1)).fill('inf')],
// //   Bs: [...new Array(nbCities).fill(2), ...new Array(nbCities * (nbCities-1)).fill(1)]
// // })
// //
// // m.compile('minimize')
// // m.optimize()
// //
// // let result = m.solutionVector
// // let resultReshaped = new Array(nbCities)
// // for (let i = 0; i < nbCities; i++) resultReshaped[i] = []
// // for (let i = 0; i < result.length; i++) {
// //   resultReshaped[Math.floor(i/(nbCities-1))].push(result[i])
// // }
// // for (let i = 0; i < nbCities; i++) {
// //   resultReshaped[i].splice(i, 0, 0)
// // }
// // console.log(result)
// // console.log(resultReshaped)
// // loop()
//
// // // VERSION DIAGONALE PENALISEE
// let nbCities = 30
// let tsp = new TSP(nbCities)
//
// let vars = new Array()
// for (let i = 0; i < nbCities; i++) {
//   for (let j = 0; j < nbCities; j++) {
//     if (i !== j) vars.push(tsp.matrixDistances[i][j])
//     else vars.push(100000000)
//   }
// }
// vars = [...vars, ...new Array(nbCities).fill(0)] // Ajout vars Ui pour cycle
// // Symétrique tsp
// let constraintsEquations = new Array(nbCities)
// for (let i = 0; i < nbCities; i++) { // Une contrainte pour chaque ville / ligne de la matrice
//   let constraint = new Array(nbCities * nbCities).fill(0)
//   // Somme à 1 en ligne
//   for (let a = i*nbCities; a < (i+1)*nbCities; a++) constraint[a] = 1
//   // Somme à 1 en colonne
//   for (let a = 0; a < nbCities; a++) constraint[a*nbCities + i] = 1
//
//   constraintsEquations[i] = [...constraint, ...new Array(nbCities).fill(0)] // Vars de cycle à 0
// }
//
//
//
// // Asymétrique tsp
// // let constraintsEquations = new Array(nbCities*2)
// // for (let i = 0; i < nbCities; i++) { // Une contrainte pour chaque ville / ligne de la matrice
// //   let constraint = new Array(nbCities * nbCities).fill(0)
// //   // Somme à 1 en Ligne
// //   for (let a = 0; a < nbCities; a++) constraint[i*nbCities + a] = 1
// //   constraintsEquations[i] = constraint
// // }
// // for (let i = 0; i < nbCities; i++) { // Une contrainte pour chaque ville / ligne de la matrice
// //   let constraint = new Array(nbCities * nbCities).fill(0)
// //   // Somme à 1 en Colonne
// //   for (let a = 0; a < nbCities; a++) constraint[a*nbCities + i] = 1
// //   constraintsEquations[i + nbCities] = constraint
// // }
//
// // Contraintes var inférieur à 1
// for (let i = 0; i < nbCities * nbCities; i++) {
//   let constraint = new Array(nbCities * nbCities + nbCities).fill(0)
//   constraint[i] = 1
//   constraintsEquations.push(constraint)
// }
//
// for (let i = 1; i < nbCities; i++) {
//   let constraint = new Array(nbCities * nbCities + nbCities).fill(0)
//   constraint[i + nbCities * nbCities] = 1 // <= n-1
//   constraintsEquations.push(constraint)
// }
// for (let i = 1; i < nbCities; i++) {
//   for (let j = 1; j < nbCities; j++) {
//     if (i !== j) {
//       let constraint = new Array(nbCities * nbCities + nbCities).fill(0)
//       constraint[i + nbCities * nbCities] = 1
//       constraint[j + nbCities * nbCities] = -1
//       constraint[i*nbCities + j-1] = nbCities
//       constraintsEquations.push(constraint)
//     }
//   }
// }
// let constraint = new Array(nbCities * nbCities + nbCities).fill(0)
// constraint[nbCities*nbCities] = 1
// constraintsEquations.push(constraint)
//
// m.addVars({
//   coeffs: vars,
//   types: [...new Array(nbCities * nbCities).fill('int'), ... new Array(nbCities).fill('real')]
// })
//
// m.addConstraints({
//   equations: constraintsEquations, // TODO: voir si inf à 1 toujours utile par la suite ?
//   constraints: [...new Array(nbCities).fill('equal'), ...new Array(nbCities * nbCities).fill('inf'), ...new Array(nbCities-1).fill('inf')     , ...new Array((nbCities-1)*(nbCities-2)).fill('inf'),      ...['equal']],
//   Bs:          [...new Array(nbCities).fill(2)      , ...new Array(nbCities * nbCities).fill(1)    , ...new Array(nbCities-1).fill(nbCities-1), ...new Array((nbCities-1)*(nbCities-2)).fill(nbCities-1), ...[1]      ]
// })
//
// m.compile('minimize')
// m.optimize()
//
// let result = m.solutionVector
// console.log(result)
// let resultReshaped = new Array(nbCities)
// for (let i = 0; i < nbCities; i++) resultReshaped[i] = []
// for (let i = 0; i < nbCities; i++) {
//   resultReshaped[Math.floor(i/nbCities)].push(result[i])
// }
// console.log(vars)
// console.log(constraintsEquations)
// console.log(result)
// console.log(resultReshaped)
// // loop()
// draw(tsp, resultReshaped, nbCities)
// }
//
// // const loop = () => {
// //   requestAnimationFrame(loop)
// // }
//
// const draw = (tsp, result, nbCities) => {
// ctx.clearRect(0, 0, canvas.width, canvas.height)
// ctx.fillStyle = "#000000"
//
// for (let i = 0; i < tsp.cities.length; i++) { // Dessine les points
//   ctx.beginPath()
//   ctx.arc(tsp.cities[i].x + 50, tsp.cities[i].y + 50, 5, 0, 2*Math.PI)
//   ctx.fill()
// }
//
// for (let i = 0; i < nbCities; i++) {
//   for (let j = 0; j < nbCities; j++) {
//     if (result[i][j] === 1) {
//       ctx.beginPath()
//       ctx.moveTo(tsp.cities[i].x + 50, tsp.cities[i].y + 50) // Dessine le chemin entre les points
//       ctx.lineTo(tsp.cities[j].x + 50, tsp.cities[j].y + 50)
//       ctx.stroke()
//     }
//   }
//
// }
// }
//
// window.addEventListener('load', init)
