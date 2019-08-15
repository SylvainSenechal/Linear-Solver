const recalculateWidthInput = e => {
  let newLength = [...e.target.value].length
  e.target.style.width = `${Math.max(15, 5+newLength*10)}px`
}
document.addEventListener('input', recalculateWidthInput)


const addEquation = sender => {
  let listEquations = document.getElementsByClassName('listEquations')[0]
  let newEquation = document.getElementById('newEquation')

  let stringEquation = codeToStringEquation(newEquation.innerHTML)
  let domNewEquation = stringEquationToDomEquation(stringEquation);

  [...newEquation.getElementsByTagName('input')].forEach( (input, index) => {
    domNewEquation[0].getElementsByTagName('input')[index].value = input.value
    let newLength = [...input.value].length
    domNewEquation[0].getElementsByTagName('input')[index].style.width = `${Math.max(15, 5+newLength*10)}px`
  })
  listEquations.appendChild(domNewEquation[0])
}

const codeToStringEquation = code => {
  return `<div class="equation">
    <div class="addRemoveEquation">
      <button id="buttonRemoveEquation" onclick="removeEquation(this)"> rmv </button>
    </div>
    <div class="equationCode">
      <code> ${code} </code>
    </div>
  </div>`
}

const stringEquationToDomEquation = html => {
    let template = document.createElement('template')
    template.innerHTML = html
    return template.content.childNodes
}

const removeEquation = sender => sender.parentNode.parentNode.remove()

const startOptimizing = () => {
  let listEquations = [...document.getElementsByClassName('equation')].map( equation =>  [...equation.getElementsByClassName('constraint')].map( valueConstraint => parseInt(valueConstraint.value) || 0) )
  let listSecondMembers = [...document.getElementsByClassName('equation')].map( equation => parseInt(equation.getElementsByClassName('secondMember')[0].value) || 0)
  let objectiveValues = [...document.getElementsByClassName('objectiveValue')].map( value => parseInt(value.value) || 0)
  console.table(listEquations)
  console.table(listSecondMembers)
  console.log(objectiveValues)
}

document.getElementById('max').onclick = e => {
  document.getElementById('optimizationType').style.webkitTransform= "translateY(8px)"
}
document.getElementById('min').onclick = e => {
  document.getElementById('optimizationType').style.webkitTransform= "translateY(-8px)"
}
