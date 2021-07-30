const express = require('express')
const bodyParser = require('body-parser')
const router = express.Router()

const events = []

class Person {
  static createId(firstname, lastname) {
    return `${firstname}${lastname}`.toLowerCase()
  }

  constructor(person) {
    this.firstname = person.firstname
    this.lastname = person.lastname
    this.age = person.age
    this.spouse = person.spouse
    this.id = Person.createId(this.firstname, this.lastname)
  }

  marry(personId) {
    this.spouse = personId
  }

  isMarriedTo(personId) {
    return this.spouse === personId
  }

  haveABirthday() {
    this.age += 1
  }
}

class Event {
  constructor(name, time, id) {
    this.id = id
    this.name = name
    this.time = time
  }
}

class CreatedEvent extends Event {
  static NAME = 'created'

  constructor(person) {
    super(CreatedEvent.NAME, Math.floor(Date.now() / 1000), person.id)

    this.person = person
  }
}

class MarriedEvent extends Event {
  static NAME = 'married'

  constructor(personId, marriesId) {
    super(MarriedEvent.NAME, Math.floor(Date.now() / 1000), personId)

    this.personId = personId
    this.marriesId = marriesId
  }
}

class BirthdayEvent extends Event {
  static NAME = 'birthday'

  constructor(personId) {
    super(BirthdayEvent.NAME, Math.floor(Date.now() / 1000), personId)
  }
}

const getPersonProjection = (id) => {
  const eventsAbout = events.filter((e) => e.id === id)

  if (!eventsAbout.length) {
    throw new Error('Not found')
  }

  const createdEvent = eventsAbout.shift()

  const person = new Person(createdEvent.person)

  const projectedPerson = eventsAbout.reduce((p, e) => {
    if (e.name === MarriedEvent.NAME) {
      person.marry(e.marriesId)
    } else if (e.name === BirthdayEvent.NAME) {
      person.haveABirthday()
    }

    return person
  }, person)

  return projectedPerson
}

const getPersonFromRequest = (id, res) => {
  try {
    const person = getPersonProjection(id)

    return person
  } catch (e) {
    if (e.message.includes('Not found')) {
      res.status(404).send(`${id} does not exist`)
    }
  }
}

router.get('/', (req, res, next) => {
  res.json({
    data: events
      .filter((e) => e.name === CreatedEvent.NAME)
      .map((e) => e.id)
      .map((id) => getPersonProjection(id)),
  })
})

router.get('/:id', (req, res, next) => {
  const person = getPersonFromRequest(req.params.id, res)

  if (!person) return

  res.json({
    data: person,
  })
})

router.post('/', bodyParser.json(), (req, res, next) => {
  const id = Person.createId(req.body.person.firstname, req.body.person.lastname)

  if (events.filter(e => e.id === id).length) {
    return res.sendStatus(403)
  }

  const person = new Person(req.body.person)

  events.push(new CreatedEvent(person))

  return res.status(201).json({
    data: {
      id: person.id,
    },
  })
})

router.put('/:id/birthday', bodyParser.json(), (req, res, next) => {
  const person = getPersonFromRequest(req.params.id, res)

  if (!person) return

  person.haveABirthday()
  events.push(new BirthdayEvent(person.id))

  return res.sendStatus(204)
})

router.put('/:id/marry', bodyParser.json(), (req, res, next) => {
  const update = req.body

  const person1 = getPersonFromRequest(req.params.id, res)

  if (!person1) return

  if (!person1.isMarriedTo(update.spouse)) {
    person1.marry(update.spouse)
    events.push(new MarriedEvent(person1.id, update.spouse))

    try {
      const person2 = getPersonProjection(update.spouse)

      person2.marry(person1.id)
      events.push(new MarriedEvent(person2.id, person1.id))
    } catch (e) {
      console.log(`${update.spouse} not found in database`)
    }
  }

  return res.sendStatus(204)
})

module.exports = router
