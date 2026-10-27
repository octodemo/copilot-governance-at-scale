// Frozen identity/shape metadata only. Never rendered; used solely to validate v1-v8 progress.
export default {
  "paths": [
    {
      "id": "user-governance",
      "status": "ready",
      "decisions": [
        {
          "id": "UG-01",
          "options": [
            {
              "id": "pilot",
              "deferred": false
            },
            {
              "id": "organization",
              "deferred": false
            },
            {
              "id": "enterprise-teams",
              "deferred": false
            },
            {
              "id": "enterprise-users",
              "deferred": false
            },
            {
              "id": "mixed",
              "deferred": false
            },
            {
              "id": "review",
              "deferred": true
            }
          ]
        },
        {
          "id": "UG-02",
          "options": [
            {
              "id": "central",
              "deferred": false
            },
            {
              "id": "delegate",
              "deferred": false
            },
            {
              "id": "review",
              "deferred": true
            }
          ]
        },
        {
          "id": "UG-04",
          "options": [
            {
              "id": "custom",
              "deferred": false
            },
            {
              "id": "idp",
              "deferred": false
            },
            {
              "id": "review",
              "deferred": true
            }
          ]
        },
        {
          "id": "UG-05",
          "options": [
            {
              "id": "self-service",
              "deferred": false
            },
            {
              "id": "gated",
              "deferred": false
            },
            {
              "id": "review",
              "deferred": true
            }
          ]
        },
        {
          "id": "UG-06",
          "options": [
            {
              "id": "enterprise",
              "deferred": false
            },
            {
              "id": "ai-managers",
              "deferred": false
            },
            {
              "id": "organizations",
              "deferred": false
            },
            {
              "id": "review",
              "deferred": true
            }
          ]
        },
        {
          "id": "UG-07",
          "options": [
            {
              "id": "vetted",
              "deferred": false
            },
            {
              "id": "latest",
              "deferred": false
            },
            {
              "id": "review",
              "deferred": true
            }
          ]
        },
        {
          "id": "UG-08",
          "options": [
            {
              "id": "vetted",
              "deferred": false
            },
            {
              "id": "available",
              "deferred": false
            },
            {
              "id": "review",
              "deferred": true
            }
          ]
        },
        {
          "id": "UG-09",
          "options": [
            {
              "id": "stable",
              "deferred": false
            },
            {
              "id": "previews",
              "deferred": false
            },
            {
              "id": "review",
              "deferred": true
            }
          ]
        }
      ],
      "lab": {
        "id": "UG-LAB",
        "primaryDecisionId": "UG-01",
        "requiredSavedDecisionIds": [
          "UG-01",
          "UG-02"
        ],
        "verification": {}
      }
    },
    {
      "id": "billing-cost-control",
      "status": "ready",
      "decisions": [
        {
          "id": "BC-01",
          "options": [
            {
              "id": "central",
              "deferred": false
            },
            {
              "id": "department",
              "deferred": false
            },
            {
              "id": "organization",
              "deferred": false
            },
            {
              "id": "review",
              "deferred": true
            }
          ]
        },
        {
          "id": "BC-02",
          "options": [
            {
              "id": "user",
              "deferred": false
            },
            {
              "id": "metered",
              "deferred": false
            },
            {
              "id": "layered",
              "deferred": false
            },
            {
              "id": "review",
              "deferred": true
            }
          ]
        },
        {
          "id": "BC-03",
          "options": [
            {
              "id": "dashboard",
              "deferred": false
            },
            {
              "id": "reports",
              "deferred": false
            },
            {
              "id": "review",
              "deferred": true
            }
          ]
        }
      ],
      "lab": {
        "id": "BC-LAB",
        "primaryDecisionId": "BC-02",
        "requiredDecisionIds": [
          "BC-01",
          "BC-02"
        ],
        "verification": {}
      }
    },
    {
      "id": "agent-governance",
      "status": "ready",
      "decisions": [
        {
          "id": "AG-01",
          "options": [
            {
              "id": "all",
              "deferred": false
            },
            {
              "id": "pilot",
              "deferred": false
            },
            {
              "id": "disabled",
              "deferred": false
            },
            {
              "id": "review",
              "deferred": true
            }
          ]
        },
        {
          "id": "AG-02",
          "options": [
            {
              "id": "approved",
              "deferred": false
            },
            {
              "id": "broader",
              "deferred": false
            },
            {
              "id": "disabled",
              "deferred": false
            },
            {
              "id": "review",
              "deferred": true
            }
          ]
        }
      ],
      "lab": {
        "id": "AG-LAB",
        "primaryDecisionId": "AG-01",
        "verification": {
          "fallback": {}
        }
      }
    },
    {
      "id": "context-management",
      "status": "ready",
      "decisions": [
        {
          "id": "CM-01",
          "options": [
            {
              "id": "shared",
              "deferred": false
            },
            {
              "id": "scoped",
              "deferred": false
            },
            {
              "id": "review",
              "deferred": true
            }
          ]
        },
        {
          "id": "CM-02",
          "options": [
            {
              "id": "access",
              "deferred": false
            },
            {
              "id": "exclusions",
              "deferred": false
            },
            {
              "id": "combined",
              "deferred": false
            },
            {
              "id": "review",
              "deferred": true
            }
          ]
        }
      ],
      "lab": {
        "id": "CM-LAB",
        "primaryDecisionId": "CM-01",
        "targetKind": "repository",
        "verification": {}
      }
    },
    {
      "id": "observability",
      "status": "ready",
      "decisions": [
        {
          "id": "OB-01",
          "options": [
            {
              "id": "adoption",
              "deferred": false
            },
            {
              "id": "outcomes",
              "deferred": false
            },
            {
              "id": "both",
              "deferred": false
            },
            {
              "id": "review",
              "deferred": true
            }
          ]
        },
        {
          "id": "OB-02",
          "options": [
            {
              "id": "dashboards",
              "deferred": false
            },
            {
              "id": "sessions",
              "deferred": false
            },
            {
              "id": "combined",
              "deferred": false
            },
            {
              "id": "review",
              "deferred": true
            }
          ]
        }
      ],
      "lab": {
        "id": "OB-LAB",
        "primaryDecisionId": "OB-01",
        "exerciseKind": "sample-analysis",
        "sample": {
          "fields": [
            {
              "id": "metricReference",
              "options": [
                "M-01",
                "M-02",
                "M-03",
                "M-04"
              ]
            },
            {
              "id": "adoptionChallenge"
            },
            {
              "id": "eventReference",
              "options": [
                "E-01",
                "E-02",
                "E-03"
              ]
            },
            {
              "id": "agentInvestigation"
            },
            {
              "id": "recommendation"
            },
            {
              "id": "valueAssessment"
            },
            {
              "id": "realDataLocations"
            }
          ]
        },
        "verification": {}
      }
    }
  ]
};
