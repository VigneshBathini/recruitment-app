Good question. No, the dashboard we just created is only a temporary navigation screen for testing. It is not the complete navigation we discussed for your Recruitment Workflow Platform.

Our original plan was to build a multi-organization recruitment platform with role-based access, where each user sees the modules and actions relevant to their role.

## 1. Our actual application workflow

Platform / Organization Setup

Create organization and configure its workspace

Users, Roles & Departments

Create departments, assign users and permissions

Recruitment Requirements

Create requirements, prepare job descriptions and obtain approval

Candidate Management

Publish jobs, receive applications, screen and shortlist candidates

Interviews & Hiring Decisions

Schedule interviews, collect feedback and record manager decisions

Selection & Onboarding

Offers, acceptance, onboarding and hiring completion

Later phase

## 2. How navigation should work

The application should have different navigation depending on the logged-in user's role.

Organization Admin

Dashboard · Organization Settings · Departments · Users & Roles · Permissions

Recruiter / HR

Dashboard · Requirements · Jobs · Candidates · Screening · Interviews · Hiring Pipeline

Hiring Manager

Dashboard · Pending Approvals · Assigned Requirements · Interview Feedback · Hiring Decisions

Interviewer

Dashboard · Assigned Interviews · Candidate Details · Submit Feedback

Candidate

Public Job Link · Apply for Job · My Application Status · Interview Details

## 3. What we should build now

Since we are currently developing the Organization and Department modules, I recommend this implementation order:

1. Admin dashboard — the main screen after login.
2. Organization management — create and view organizations.
3. Department management — create and edit departments for a selected organization.
4. Users and Roles — create users and assign permissions.
5. Recruitment Requirements — begin the actual hiring workflow.

We should use a shared navigation structure for web and mobile, adapting the layout to each screen size: a sidebar on desktop and a drawer or compact navigation on mobile.

One important distinction: creating an organization is an administrative setup action, not necessarily the first screen every user should see. In the finished app, login and role-based access should determine which dashboard opens.

So, keep the dashboard we created for now as a development starting point, but let's evolve it into the proper Admin Dashboard rather than treating those three cards as our final navigation.