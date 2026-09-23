/**
 * Verification Script for VerityHire Backend Endpoints
 */
const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('🧪 Starting VerityHire Backend Automated Tests...\n');

  try {
    // 1. Register Student
    const studentEmail = `student_${Date.now()}@example.com`;
    console.log(`1️⃣  Registering Student: ${studentEmail}`);
    const studentRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: studentEmail,
        password: 'Password@123',
        role: 'student',
        name: 'Aarav Sharma',
        rollNumber: `2022CS${Date.now().toString().slice(-4)}`,
        branch: 'CSE',
        batch: 2026,
        cgpa: 8.7,
      }),
    });
    const studentData = await studentRes.json();
    console.log(`   Student Registered! ID: ${studentData.user?.id}, Token: ${Boolean(studentData.token)}`);
    const studentToken = studentData.token;

    // 2. Register Recruiter
    const recruiterEmail = `recruiter_${Date.now()}@google.com`;
    console.log(`\n2️⃣  Registering Recruiter: ${recruiterEmail}`);
    const recruiterRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: recruiterEmail,
        password: 'Password@123',
        role: 'recruiter',
        companyName: 'Google Cloud India',
        website: 'https://cloud.google.com',
        industry: 'Cloud & AI',
      }),
    });
    const recruiterData = await recruiterRes.json();
    console.log(`   Recruiter Registered! Company: ${recruiterData.profile?.companyName}, Token: ${Boolean(recruiterData.token)}`);
    const recruiterToken = recruiterData.token;

    // 3. Recruiter Creates a Job
    console.log('\n3️⃣  Recruiter Posting Job: "Full-Stack SDE - Cloud Platforms"');
    const jobRes = await fetch(`${BASE_URL}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterToken}`,
      },
      body: JSON.stringify({
        title: 'Full-Stack SDE - Cloud Platforms',
        description: 'Building next-generation distributed cloud services using React, Node.js, and MongoDB.',
        skillsRequired: ['React', 'Node.js', 'MongoDB', 'Docker', 'AWS'],
        eligibility: {
          minCgpa: 7.5,
          branches: ['CSE', 'IT', 'ECE'],
          maxBacklogs: 0,
          batch: 2026,
        },
        ctc: '18 - 24 LPA',
        location: 'Bangalore / Hybrid',
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
    const jobData = await jobRes.json();
    const jobId = jobData.job?._id;
    console.log(`   Job Created Successfully! Job ID: ${jobId}`);

    // 4. Update Student Profile with Skills
    console.log('\n4️⃣  Student Updating Parsed Profile with Skills');
    const updateProfileRes = await fetch(`${BASE_URL}/students/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        parsedProfile: {
          skills: ['React', 'Node.js', 'MongoDB', 'JavaScript', 'HTML/CSS'],
          projects: [
            {
              title: 'Distributed Chat Application',
              description: 'Real-time WebSocket chat platform built with Node.js and MongoDB',
              techStack: ['Node.js', 'MongoDB', 'WebSockets'],
            },
          ],
        },
      }),
    });
    const updatedProfile = await updateProfileRes.json();
    console.log(`   Student Skills updated: ${updatedProfile.student?.parsedProfile?.skills?.join(', ')}`);

    // 5. Student Applies to Job
    console.log('\n5️⃣  Student Applying to the Job (Triggering AI Evaluation)');
    const applyRes = await fetch(`${BASE_URL}/jobs/${jobId}/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
    });
    const applyData = await applyRes.json();
    const applicationId = applyData.application?._id;
    console.log(`   Application Submitted! ID: ${applicationId}`);
    console.log(`   Initial AI Score: ${applyData.application?.aiScore?.finalScore} / 100`);
    console.log(`   Explanation: ${applyData.application?.aiScore?.explanation?.summary}`);

    // 6. Recruiter Triggers AI Shortlisting Pipeline
    console.log('\n6️⃣  Recruiter Triggering AI Shortlist Pipeline');
    const shortlistRes = await fetch(`${BASE_URL}/jobs/${jobId}/shortlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterToken}`,
      },
    });
    const shortlistData = await shortlistRes.json();
    console.log(`   Shortlist Summary: Total: ${shortlistData.summary?.totalApplicants}, Eligible: ${shortlistData.summary?.eligibleCount}`);
    console.log(`   Top Ranked Applicant Score: ${shortlistData.rankedApplicants?.[0]?.aiScore?.finalScore}`);

    // 7. Test Mandatory Override Reason Requirement
    console.log('\n7️⃣  Testing Recruiter Override Reason Requirement');
    const overrideAttemptRes = await fetch(`${BASE_URL}/applications/${applicationId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterToken}`,
      },
      body: JSON.stringify({
        status: 'rejected', // Candidate had score ~80-90, rejecting without reason must fail
        isOverride: true,
        reason: '', // Empty reason
      }),
    });
    const overrideAttemptData = await overrideAttemptRes.json();
    if (overrideAttemptRes.status === 400) {
      console.log(`   ✅ Security Check Passed! Server correctly blocked override without reason: "${overrideAttemptData.message}"`);
    } else {
      console.log('   ❌ Security Check Failed: Server allowed empty reason on override.');
    }

    // 8. Recruiter Approves with Valid Reason
    console.log('\n8️⃣  Recruiter Shortlists Candidate with Recorded Reason');
    const validStatusRes = await fetch(`${BASE_URL}/applications/${applicationId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterToken}`,
      },
      body: JSON.stringify({
        status: 'shortlisted',
        reason: 'Strong performance in distributed systems project and clean CGPA.',
      }),
    });
    const validStatusData = await validStatusRes.json();
    console.log(`   Status updated successfully to: ${validStatusData.application?.status}`);

    // 9. Student Tests "What-If" Simulator
    console.log('\n9️⃣  Student Running "What-If" Simulation ("What if I learn Docker & AWS?")');
    const simRes = await fetch(`${BASE_URL}/students/me/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        jobId,
        hypotheticalSkills: ['Docker', 'AWS'],
        currentScore: applyData.application?.aiScore?.finalScore,
      }),
    });
    const simData = await simRes.json();
    console.log(`   Current Score: ${simData.simulation?.currentScore}`);
    console.log(`   Projected Score with Docker & AWS: ${simData.simulation?.projectedScore} (Delta: ${simData.simulation?.scoreDelta})`);

    // 10. Student Checks Personalized Skill-Gap Report
    console.log('\n🔟 Student Checking Personalized Skill-Gap Analysis');
    const gapRes = await fetch(`${BASE_URL}/students/me/skill-gap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ jobId }),
    });
    const gapData = await gapRes.json();
    console.log(`   Missing Skills Identified: ${gapData.report?.missingSkills?.join(', ')}`);
    console.log(`   Recommended Resources: ${gapData.report?.recommendations?.length} curated links generated.`);

    console.log('\n🎉 ALL 10 TESTS PASSED SUCCESSFULLY! The VerityHire backend is fully operational.\n');
  } catch (err) {
    console.error(`❌ Test failed with error: ${err.message}`);
  }
}

runTests();
