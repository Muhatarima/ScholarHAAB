'use client'

import React from 'react'

const TEAM_MEMBERS = [
  {
    name: 'Sarah Rahman',
    role: 'Lead AI Architect',
    email: 'sarah@scholarhaab.com',
    image: 'https://img.freepik.com/free-photo/portrait-optimistic-businessman-wearing-jacket-isolated-blue-background_1258-26154.jpg' // Generic placeholder
  },
  {
    name: 'Imran Ahmed',
    role: 'Product Lead',
    email: 'imran@scholarhaab.com',
    image: 'https://img.freepik.com/free-photo/lifestyle-people-emotions-concept-close-up-confident-young-asian-man-black-t-shirt-smiling_1258-59288.jpg'
  },
  {
    name: 'Nadia Islam',
    role: 'Full Stack Engineer',
    email: 'nadia@scholarhaab.com',
    image: 'https://img.freepik.com/free-photo/young-beautiful-woman-pink-warm-sweater-natural-look-smiling-portrait-isolated-long-hair_285396-896.jpg'
  }
]

export default function TeamSection() {
  return (
    <div className="teamGrid">
      {TEAM_MEMBERS.map((member, i) => (
        <div key={i} className="teamMember">
          <img src={member.image} alt={member.name} className="memberImg" />
          <div className="memberName">{member.name}</div>
          <div className="memberRole">{member.role}</div>
          <div className="memberEmail">{member.email}</div>
        </div>
      ))}
    </div>
  )
}
